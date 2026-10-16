// SIEM webhook configuration + alert dispatch.
//
// Security properties:
// - Shared secrets are encrypted at rest (AES-256-GCM, key from typed
//   config) and NEVER returned by reads — callers see `hasSecret` only.
// - Destinations pass an SSRF guard (HTTPS in production, no private /
//   link-local / metadata addresses) both at configuration time and at
//   dispatch time.
// - Persisted to a JSON file in the db folder so it survives restarts.
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { encryptSecret, decryptSecret } from "./crypto";
import { assertSafeWebhookUrl } from "./ssrf-guard";
import { logger } from "./logger";
import { getConfig } from "./config";

export interface WebhookTarget {
  id: string;
  name: string;
  url: string;
  type: "slack" | "teams" | "generic" | "email";
  enabled: boolean;
  /** AES-256-GCM sealed secret (never the plaintext). Omitted on reads. */
  secretSealed?: string;
  events: string[]; // e.g. ["denied","lockdown","spoof","supervisor_override"]
  createdAt: string;
}

/** Public view of a target — secret never leaves the server. */
export interface WebhookTargetPublic extends Omit<WebhookTarget, "secretSealed"> {
  hasSecret: boolean;
}

interface WebhookState {
  targets: WebhookTarget[];
  globalEnabled: boolean;
  lastDispatchAt: string | null;
  dispatchCount: number;
  failureCount: number;
}

// State file lives under the configured absolute data directory — never a
// cwd-relative path (the server's cwd is not stable, e.g. Next standalone).
function stateFile(): string {
  return path.join(getConfig().dataDir, "webhook-state.json");
}

const DEFAULT_STATE: WebhookState = {
  targets: [],
  globalEnabled: true,
  lastDispatchAt: null,
  dispatchCount: 0,
  failureCount: 0,
};

async function readState(): Promise<WebhookState> {
  try {
    const raw = await fs.readFile(stateFile(), "utf-8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(s: WebhookState): Promise<void> {
  await fs.mkdir(path.dirname(stateFile()), { recursive: true });
  await fs.writeFile(stateFile(), JSON.stringify(s, null, 2), "utf-8");
}

function toPublic(t: WebhookTarget): WebhookTargetPublic {
  const { secretSealed: _omit, ...rest } = t;
  return { ...rest, hasSecret: !!t.secretSealed };
}

export async function getWebhookState(): Promise<{
  targets: WebhookTargetPublic[];
  globalEnabled: boolean;
  lastDispatchAt: string | null;
  dispatchCount: number;
  failureCount: number;
}> {
  const s = await readState();
  return {
    targets: s.targets.map(toPublic),
    globalEnabled: s.globalEnabled,
    lastDispatchAt: s.lastDispatchAt,
    dispatchCount: s.dispatchCount,
    failureCount: s.failureCount,
  };
}

async function getTargetById(id: string): Promise<WebhookTarget | undefined> {
  const s = await readState();
  return s.targets.find((t) => t.id === id);
}

export interface SaveTargetInput {
  id?: string;
  name: string;
  url: string;
  type: WebhookTarget["type"];
  enabled: boolean;
  /** Plaintext secret (optional). Encrypted before storage. Omit to keep existing. */
  secret?: string;
  /** Set true to explicitly clear the stored secret. */
  clearSecret?: boolean;
  events: string[];
}

/** Create or update a webhook target. Validates + SSRF-checks the URL. */
export async function saveWebhookTarget(
  input: SaveTargetInput,
): Promise<ReturnType<typeof getWebhookState>> {
  await assertSafeWebhookUrl(input.url);

  const s = await readState();
  const existing = input.id ? s.targets.find((t) => t.id === input.id) : undefined;
  const id = input.id ?? `whk_${randomBytes(6).toString("hex")}`;

  let secretSealed = existing?.secretSealed;
  if (input.clearSecret) secretSealed = undefined;
  if (input.secret) secretSealed = encryptSecret(input.secret);

  const target: WebhookTarget = {
    id,
    name: input.name.slice(0, 120),
    url: input.url,
    type: input.type,
    enabled: input.enabled,
    secretSealed,
    events: input.events.slice(0, 20),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  const idx = s.targets.findIndex((t) => t.id === id);
  if (idx >= 0) s.targets[idx] = target;
  else s.targets.push(target);
  await writeState(s);
  logger.info("webhook target saved", { targetId: id, url: input.url });
  return getWebhookState();
}

export async function deleteWebhookTarget(
  id: string,
): Promise<ReturnType<typeof getWebhookState>> {
  const s = await readState();
  s.targets = s.targets.filter((t) => t.id !== id);
  await writeState(s);
  logger.info("webhook target deleted", { targetId: id });
  return getWebhookState();
}

export async function setGlobalEnabled(
  enabled: boolean,
): Promise<ReturnType<typeof getWebhookState>> {
  const s = await readState();
  s.globalEnabled = enabled;
  await writeState(s);
  return getWebhookState();
}

// Dispatch an alert event to all enabled+matching webhook targets.
// Returns per-target results. Best-effort (non-blocking failures).
// If forceAll=true, ignore the event-type filter (used by test alerts).
export async function dispatchAlert(event: {
  type: string; // "denied" | "lockdown" | "spoof" | "supervisor_override" | "granted"
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  kioskId?: string;
  employeeCode?: string | null;
  timestamp: string;
}, forceAll = false): Promise<{ targetId: string; name: string; ok: boolean; status?: number; error?: string }[]> {
  const s = await readState();
  const results: { targetId: string; name: string; ok: boolean; status?: number; error?: string }[] = [];

  if (!s.globalEnabled) return results;

  const matching = s.targets.filter(
    (t) => t.enabled && (forceAll || t.events.includes(event.type))
  );

  for (const t of matching) {
    try {
      // Defense in depth: re-validate the destination at dispatch time.
      await assertSafeWebhookUrl(t.url);
      const body = formatPayload(t.type, event);
      const serialized = JSON.stringify(body);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (t.secretSealed) {
        let secret: string;
        try {
          secret = decryptSecret(t.secretSealed);
        } catch {
          throw new Error("Stored webhook secret failed to decrypt");
        }
        const crypto = await import("crypto");
        const sig = crypto
          .createHmac("sha256", secret)
          .update(serialized)
          .digest("hex");
        headers["X-SentinelKiosk-Signature"] = `sha256=${sig}`;
      }
      const res = await fetch(t.url, {
        method: "POST",
        headers,
        body: serialized,
        signal: controller.signal,
        // Never follow redirects to a different origin for credentialed posts.
        redirect: "error",
      });
      clearTimeout(timeout);
      results.push({
        targetId: t.id,
        name: t.name,
        ok: res.ok,
        status: res.status,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ targetId: t.id, name: t.name, ok: false, error: msg });
    }
  }

  // Update stats (best-effort)
  const newS = await readState();
  newS.lastDispatchAt = new Date().toISOString();
  newS.dispatchCount += 1;
  if (results.some((r) => !r.ok)) newS.failureCount += 1;
  await writeState(newS);

  return results;
}

function formatPayload(
  targetType: WebhookTarget["type"],
  event: {
    type: string;
    severity: string;
    title: string;
    message: string;
    kioskId?: string;
    employeeCode?: string | null;
    timestamp: string;
  }
): Record<string, unknown> {
  const base = {
    source: "SentinelKiosk",
    event_type: event.type,
    severity: event.severity,
    title: event.title,
    message: event.message,
    kiosk_id: event.kioskId ?? null,
    employee_code: event.employeeCode ?? null,
    timestamp: event.timestamp,
  };

  if (targetType === "slack") {
    const color =
      event.severity === "critical"
        ? "#dc2626"
        : event.severity === "warning"
          ? "#d97706"
          : "#10b981";
    return {
      attachments: [
        {
          color,
          fallback: event.title,
          title: `🔒 ${event.title}`,
          text: event.message,
          ts: Math.floor(new Date(event.timestamp).getTime() / 1000),
          fields: [
            { title: "Event", value: event.type, short: true },
            { title: "Kiosk", value: event.kioskId ?? "—", short: true },
            { title: "Severity", value: event.severity, short: true },
            { title: "Employee", value: event.employeeCode ?? "—", short: true },
          ],
        },
      ],
    };
  }
  if (targetType === "teams") {
    const themeColor =
      event.severity === "critical"
        ? "DC2626"
        : event.severity === "warning"
          ? "D97706"
          : "10B981";
    return {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor,
      summary: event.title,
      sections: [
        {
          activityTitle: `🔒 ${event.title}`,
          activityText: event.message,
          facts: [
            { name: "Event", value: event.type },
            { name: "Kiosk", value: event.kioskId ?? "—" },
            { name: "Severity", value: event.severity },
            { name: "Employee", value: event.employeeCode ?? "—" },
            { name: "Timestamp", value: event.timestamp },
          ],
        },
      ],
    };
  }
  // generic / email
  return base;
}

export { getTargetById };
