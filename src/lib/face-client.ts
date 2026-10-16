"use client";

/**
 * Client-side replica of the server's `generateEmbedding` (see src/lib/crypto.ts).
 *
 * The server uses Node's `crypto.createHash("sha256").update(str).digest()`
 * which returns a 32-byte buffer per call. The kiosk needs to produce the
 * IDENTICAL 512-d L2-normalized vector for the same seed (employee code)
 * so the backend's `cosineSimilarity(probe, enrolled)` returns ~1.0 and the
 * scan is GRANTED.
 *
 * We re-implement the same loop with the Web Crypto API
 * (`crypto.subtle.digest("SHA-256", ...)`) which is available in browsers and
 * produces the exact same SHA-256 bytes for the same UTF-8 input string.
 *
 * Algorithm (mirrors src/lib/crypto.ts::generateEmbedding exactly):
 *   vec = []
 *   counter = 0
 *   while vec.length < 512:
 *     buf = sha256(`${seed}:${counter}`)         // 32 bytes
 *     for byte in buf:
 *       if vec.length >= 512: break
 *       vec.push((byte / 127.5) - 1)              // maps 0..255 to -1..1
 *     counter += 1
 *     if counter > 40: break
 *   return normalize(vec.slice(0, 512))
 *
 * NOTE: the server also computes `h = sha256(seed)` once before the loop but
 * never uses `h` — it's a no-op leftover. We omit it here to avoid an extra
 * async call (output is unaffected).
 */

const TEXT_ENCODER = new TextEncoder();

async function sha256Bytes(message: string): Promise<Uint8Array> {
  const data = TEXT_ENCODER.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/** L2-normalize a vector (identical to server `normalize`). */
export function normalizeVector(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

/**
 * Deterministic 512-d embedding for a seed string.
 * Reproduces the server's `generateEmbedding` exactly.
 */
export async function generateEmbeddingClient(seed: string): Promise<number[]> {
  const vec: number[] = [];
  let counter = 0;
  while (vec.length < 512) {
    const buf = await sha256Bytes(`${seed}:${counter}`);
    for (let i = 0; i < buf.length && vec.length < 512; i += 1) {
      vec.push(buf[i] / 127.5 - 1);
    }
    counter += 1;
    if (counter > 40) break;
  }
  return normalizeVector(vec.slice(0, 512));
}

/**
 * Add tiny per-component noise (~±2.5%) to a probe so similarity against the
 * enrolled embedding lands around 0.95 — still well above the granted
 * threshold (0.85) but visually "real" instead of an exact 1.0000 match.
 *
 * Same shape as the server's `simulateProbe` but uses a configurable smaller
 * noise magnitude so the demo still grants cleanly.
 */
export function addProbeNoise(
  embedding: number[],
  magnitude = 0.025,
  rng: () => number = Math.random,
): number[] {
  const probe = embedding.map((x) => x + (rng() - 0.5) * magnitude);
  return normalizeVector(probe);
}

/**
 * Convenience: build a realistic "live" probe for an employee by seed.
 * Returns the embedding array + an expected similarity estimate for display.
 */
export async function buildLiveProbe(
  employeeCode: string,
  opts: { noise?: number; rng?: () => number } = {},
): Promise<{ embedding: number[]; expectedSimilarity: number }> {
  const base = await generateEmbeddingClient(employeeCode);
  const noise = opts.noise ?? 0.025;
  const probe = noise > 0 ? addProbeNoise(base, noise, opts.rng) : base;
  // expected cosine ≈ 1 - noise^2/4 (rough); report conservative 0.95.
  const expectedSimilarity = noise > 0 ? 0.95 : 1.0;
  return { embedding: probe, expectedSimilarity };
}
