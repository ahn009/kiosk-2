// Server-side helper to push alerts to the WebSocket alerts mini-service.
// The alerts service runs on port 3003 and broadcasts to connected admin
// dashboards. This is fire-and-forget (best-effort, non-blocking).

const ALERTS_SERVICE_URL =
  process.env.ALERTS_SERVICE_URL || "http://localhost:3003/emit";

interface AlertPayload {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  kioskId?: string;
  employeeCode?: string | null;
  timestamp?: string;
}

export async function emitAlert(payload: AlertPayload): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(ALERTS_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // best-effort: if the alerts service is down, alerts still get logged
    // via the SIEM webhook dispatch + the immutable scan_events audit trail.
  }
}
