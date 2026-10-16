import crypto from "crypto";
import { getConfig } from "./config";

// ---- Card-token signing ----
// HMAC-SHA256 with a per-organization key (v2 token format). The key comes
// from typed config: in production the process refuses to boot without a
// strong ORG_SIGNING_KEY; in dev an ephemeral per-process key is used with a
// warning. There is intentionally no stable fallback key.
function signingKey(): string {
  return getConfig().orgSigningKey;
}

function keyId(): string {
  return getConfig().keyId;
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomNonce(bytes = 8): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Sign a message with HMAC-SHA256, return hex. */
function hmacSign(message: string): string {
  return crypto
    .createHmac("sha256", signingKey())
    .update(message)
    .digest("hex");
}

/**
 * Build a QR token: v2.<org_code>.<key_id>.<nonce>.<exp_epoch>.<signature>
 * The signature covers v2.org_code.key_id.nonce.exp
 */
export function buildToken(opts: {
  orgCode: string;
  expEpoch: number; // seconds
  nonce?: string;
}): { token: string; nonce: string; keyId: string; exp: number } {
  const nonce = opts.nonce ?? randomNonce();
  const kid = keyId();
  const message = `v2.${opts.orgCode}.${kid}.${nonce}.${opts.expEpoch}`;
  const sig = hmacSign(message);
  const token = `${message}.${sig}`;
  return { token, nonce, keyId: kid, exp: opts.expEpoch };
}

export type TokenVerifyResult =
  | {
      ok: true;
      orgCode: string;
      keyId: string;
      nonce: string;
      exp: number;
      tokenHash: string;
    }
  | { ok: false; reason: "invalid_token" | "expired" | "bad_signature" };

/** Verify a QR token's signature & expiry. Does NOT check revocation. */
export function verifyToken(token: string): TokenVerifyResult {
  const parts = token.trim().split(".");
  if (parts.length !== 6 || parts[0] !== "v2") {
    return { ok: false, reason: "invalid_token" };
  }
  const [, orgCode, keyId, nonce, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0) {
    return { ok: false, reason: "invalid_token" };
  }
  const message = `v2.${orgCode}.${keyId}.${nonce}.${expStr}`;
  const expected = hmacSign(message);
  if (!safeEqual(expected, sig)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (Math.floor(Date.now() / 1000) > exp) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, orgCode, keyId, nonce, exp, tokenHash: sha256(token) };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Hash a PIN/password with bcrypt-like work factor using scrypt (built-in). */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(secret, salt, 32)
    .toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = parts[2];
  const hash = crypto.scryptSync(secret, salt, 32).toString("hex");
  return safeEqual(hash, expected);
}

/** Generate a 6-digit supervisor PIN using a CSPRNG. */
export function generatePin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

// ---- Authenticated encryption for secrets at rest (e.g. webhook secrets) ----
// AES-256-GCM with a 96-bit random nonce. Output format: base64url(nonce) +
// "." + base64url(ciphertext||tag). Key comes from typed config (fail-closed
// in production).
function webhookKey(): Buffer {
  const raw = getConfig().webhookEncryptionKey;
  // Normalize to 32 bytes: hex (64 chars) or utf-8, hashed if needed.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const buf = Buffer.from(raw, "utf-8");
  if (buf.length === 32) return buf;
  return crypto.createHash("sha256").update(buf).digest();
}

export function encryptSecret(plaintext: string): string {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", webhookKey(), nonce);
  const ct = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64u = (b: Buffer) =>
    b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64u(nonce)}.${b64u(Buffer.concat([ct, tag]))}`;
}

export function decryptSecret(sealed: string): string {
  const unb64u = (s: string) =>
    Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const [nonceB64, dataB64] = sealed.split(".");
  if (!nonceB64 || !dataB64) throw new Error("Malformed sealed secret");
  const nonce = unb64u(nonceB64);
  const data = unb64u(dataB64);
  const tag = data.subarray(data.length - 16);
  const ct = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", webhookKey(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf-8");
}

// ---- Face embedding helpers (DEMO ONLY) ----
// Deterministic stand-ins for a real biometric pipeline. These MUST NOT run
// in production: enrollment/verification paths that use them are gated behind
// DEMO_MODE (see demo-guard.ts). A production deployment needs a trusted
// pipeline (see docs/PRODUCTION_ROADMAP.md Phase 5).
// In production: InsightFace ArcFace produces a 512-d vector. Here we
// deterministically generate a stable 512-d vector from an employee seed so
// the demo "match" logic is realistic and reproducible.
export function generateEmbedding(seed: string): number[] {
  const vec: number[] = [];
  const h = crypto.createHash("sha256").update(seed).digest();
  let counter = 0;
  while (vec.length < 512) {
    const buf = crypto
      .createHash("sha256")
      .update(seed + ":" + counter)
      .digest();
    for (let i = 0; i < buf.length && vec.length < 512; i += 1) {
      // map byte to [-1, 1]-ish
      vec.push((buf[i] / 127.5) - 1);
    }
    counter += 1;
    if (counter > 40) break;
  }
  // zero out hash reuse to exactly 512
  return normalize(vec.slice(0, 512));
}

export function normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // vectors assumed L2-normalized → dot == cosine
  return dot;
}

/** Simulate a "live" probe around the enrolled embedding with small noise. */
export function simulateProbe(enrolled: number[], live = true): number[] {
  const noise = live ? 0.04 : 0.35;
  const probe = enrolled.map((x) => x + (Math.random() - 0.5) * noise);
  return normalize(probe);
}
