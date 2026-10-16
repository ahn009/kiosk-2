// Central typed configuration. All server code reads env through here —
// never process.env directly for security-sensitive values.
//
// Fail-closed rule: in production (NODE_ENV=production) every required
// secret must be present and strong, otherwise the process refuses to boot.
// In development/test an ephemeral key is generated per process with a loud
// warning, so a checked-in or missing secret can never silently become the
// production signing key.
import { randomBytes } from "crypto";
import path from "path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DEMO_MODE: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ORG_SIGNING_KEY: z.string().optional(),
  KEY_ID: z.string().default("k1"),
  WEBHOOK_ENCRYPTION_KEY: z.string().optional(),
  ALERTS_SERVICE_URL: z.string().default("http://localhost:3003/emit"),
  // Directory for file-based state (webhook config). Must be absolute in
  // production — relative paths break when the server's cwd differs (e.g.
  // Next.js standalone). Defaults to ./db under the process cwd.
  DATA_DIR: z.string().optional(),
  // "simulated" = deterministic demo biometrics (requires DEMO_MODE for
  // verification paths). "external" = a trusted pipeline verifies face/PAD
  // evidence and this app only enforces policy on its signed verdict.
  BIOMETRIC_MODE: z.enum(["simulated", "external"]).default("simulated"),
});

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  isProduction: boolean;
  demoMode: boolean;
  databaseUrl: string;
  /** HMAC signing key for card tokens. Never the checked-in dev value. */
  orgSigningKey: string;
  keyId: string;
  /** AES-256-GCM key for webhook secrets at rest. */
  webhookEncryptionKey: string;
  alertsServiceUrl: string;
  biometricMode: "simulated" | "external";
  /** Absolute directory for file-based state. Always absolute. */
  dataDir: string;
}

const PLACEHOLDER_RE = /replace-with|changeme|example|do-not-use-in-prod/i;

function resolveSecret(
  name: string,
  value: string | undefined,
  isProduction: boolean,
  minLen: number,
): string {
  if (value && value.length >= minLen && !PLACEHOLDER_RE.test(value)) {
    return value;
  }
  if (isProduction) {
    throw new Error(
      `[config] ${name} must be set to a random secret of at least ${minLen} characters in production. Refusing to boot.`,
    );
  }
  // Ephemeral per-process key: dev convenience without a stable known secret.
  const ephemeral = randomBytes(32).toString("hex");
  console.warn(
    `[config] WARNING: ${name} is missing or weak — using an ephemeral dev key for this process only. ` +
      `Set a strong ${name} before any non-local use.`,
  );
  return ephemeral;
}

let cached: AppConfig | null = null;

/** Resolve the data directory to an absolute path. Production requires it. */
function resolveDataDir(value: string | undefined, isProduction: boolean): string {
  if (value) {
    if (!path.isAbsolute(value)) {
      throw new Error(
        "[config] DATA_DIR must be an absolute path. Refusing to boot.",
      );
    }
    return value;
  }
  if (isProduction) {
    throw new Error(
      "[config] DATA_DIR must be set to an absolute path in production (e.g. /var/lib/sentinel-kiosk). Refusing to boot.",
    );
  }
  const dir = path.join(process.cwd(), "db");
  console.warn(
    `[config] DATA_DIR not set — using ${dir} (dev default). Set an absolute DATA_DIR in production.`,
  );
  return dir;
}

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `[config] Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
    );
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  if (env.DEMO_MODE && isProduction) {
    console.warn(
      "[config] WARNING: DEMO_MODE=true in production. Demo routes, simulators and simulated biometrics are enabled. " +
        "This must never control a real door.",
    );
  }

  cached = {
    nodeEnv: env.NODE_ENV,
    isProduction,
    demoMode: env.DEMO_MODE,
    databaseUrl: env.DATABASE_URL,
    orgSigningKey: resolveSecret("ORG_SIGNING_KEY", env.ORG_SIGNING_KEY, isProduction, 32),
    keyId: env.KEY_ID,
    webhookEncryptionKey: resolveSecret(
      "WEBHOOK_ENCRYPTION_KEY",
      env.WEBHOOK_ENCRYPTION_KEY,
      isProduction,
      32,
    ),
    alertsServiceUrl: env.ALERTS_SERVICE_URL,
    biometricMode: env.BIOMETRIC_MODE,
    dataDir: resolveDataDir(env.DATA_DIR, isProduction),
  };
  return cached;
}

/** True when simulated/demo-only behavior is permitted to run. */
export function demoModeEnabled(): boolean {
  return getConfig().demoMode;
}
