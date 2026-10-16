// Transient in-memory store for pending kiosk scans (verify-token → verify-face).
// In production this would be Redis with a short TTL; here we keep it in-process.
// IMPORTANT: stored on `globalThis` so it survives Next.js dev-mode hot reloads
// (each route handler gets its own module instance of this file, so a module-level
// `Map` would be duplicated per route. globalThis is shared across all module
// instances in the same Node process).

export interface PendingScan {
  scanId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  accessLevel: number;
  photoUrl: string | null;
  kioskId: string;
  tokenHash: string;
  startedAt: number; // epoch ms
  challengeSeed: "blink" | "turn_left" | "turn_right";
}

const g = globalThis as unknown as {
  __kioskPendingScans?: Map<string, PendingScan>;
};
if (!g.__kioskPendingScans) g.__kioskPendingScans = new Map();
const pendingScans = g.__kioskPendingScans;

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function gc() {
  const now = Date.now();
  for (const [id, scan] of pendingScans.entries()) {
    if (now - scan.startedAt > TTL_MS) {
      pendingScans.delete(id);
    }
  }
}

export function createPendingScan(scan: PendingScan): void {
  pendingScans.set(scan.scanId, scan);
  gc();
}

export function getPendingScan(scanId: string): PendingScan | null {
  const s = pendingScans.get(scanId);
  if (!s) return null;
  if (Date.now() - s.startedAt > TTL_MS) {
    pendingScans.delete(scanId);
    return null;
  }
  return s;
}

export function deletePendingScan(scanId: string): void {
  pendingScans.delete(scanId);
}
