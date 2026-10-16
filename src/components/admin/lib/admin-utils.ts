"use client";

import type {
  CardStatus,
  Decision,
  FaceMatchStatus,
  AdminRole,
  KioskStatus,
} from "@/lib/types";

// ---------- Decision / status color maps ----------

export const decisionVariant: Record<
  Decision,
  "default" | "secondary" | "destructive" | "outline"
> = {
  granted: "default",
  denied: "destructive",
  challenge_failed: "destructive",
  error: "destructive",
  lockdown: "destructive",
  supervisor_override: "secondary",
};

export const decisionClass: Record<Decision, string> = {
  granted: "bg-success/15 text-success border-success/30",
  denied: "bg-destructive/15 text-destructive border-destructive/30",
  challenge_failed: "bg-warning/15 text-warning-foreground border-warning/40",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  lockdown: "bg-destructive/20 text-destructive border-destructive/40",
  supervisor_override:
    "bg-secondary text-secondary-foreground border-border",
};

export const cardStatusClass: Record<CardStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  revoked: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  lost: "bg-warning/15 text-warning-foreground border-warning/40",
};

export const kioskStatusClass: Record<KioskStatus, string> = {
  online: "bg-success",
  offline: "bg-muted-foreground",
  maintenance: "bg-warning",
  lockdown: "bg-destructive",
};

export const faceMatchStatusClass: Record<FaceMatchStatus, string> = {
  match: "bg-success/15 text-success border-success/30",
  mismatch: "bg-destructive/15 text-destructive border-destructive/30",
  no_face: "bg-muted text-muted-foreground border-border",
  liveness_fail: "bg-warning/15 text-warning-foreground border-warning/40",
};

export const roleBadgeClass: Record<AdminRole, string> = {
  superadmin: "bg-primary/15 text-primary border-primary/30",
  security_officer: "bg-destructive/15 text-destructive border-destructive/30",
  hr_admin: "bg-warning/15 text-warning-foreground border-warning/40",
  viewer: "bg-muted text-muted-foreground border-border",
};

export const accessLevelClass = (lvl: number): string => {
  if (lvl >= 5) return "bg-destructive/15 text-destructive border-destructive/30";
  if (lvl >= 4) return "bg-warning/15 text-warning-foreground border-warning/40";
  if (lvl >= 3) return "bg-primary/15 text-primary border-primary/30";
  if (lvl >= 2) return "bg-secondary text-secondary-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
};

export const roleLabel: Record<AdminRole, string> = {
  superadmin: "Super Admin",
  security_officer: "Security Officer",
  hr_admin: "HR Admin",
  viewer: "Viewer",
};

// ---------- Formatters ----------

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function formatPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------- CSV export ----------

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

// ---------- Array unwrap ----------
// Some list endpoints (kiosks, departments, admin/users, revocations) wrap
// results in { items: [...] } at runtime even though the api-client typings
// declare a bare T[]. This helper normalises both shapes to a T[] so views
// can iterate safely.
export function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object" && "items" in d) {
    const items = (d as { items: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}
