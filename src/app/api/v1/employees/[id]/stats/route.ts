import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

// Per-employee scan analytics: daily counts (last 30 days), decision breakdown,
// per-kiosk breakdown, match-score distribution, last 10 scans.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if (auth.response) return auth.response;

  const { id } = await params;
  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setUTCHours(0, 0, 0, 0);

  const scans = await db.scanEvent.findMany({
    where: { employeeId: id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kioskId: true,
      decision: true,
      faceMatchStatus: true,
      faceMatchScore: true,
      latencyMs: true,
      offline: true,
      createdAt: true,
    },
  });

  // Daily buckets (last 30 days)
  const daily: { date: string; granted: number; denied: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, granted: 0, denied: 0 });
  }
  const dayIndex = new Map(daily.map((d, i) => [d.date, i]));
  for (const s of scans) {
    const key = s.createdAt.toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx === undefined) continue;
    if (s.decision === "granted") daily[idx].granted += 1;
    else if (["denied", "challenge_failed"].includes(s.decision))
      daily[idx].denied += 1;
  }

  // Decision breakdown
  const breakdown: Record<string, number> = {};
  for (const s of scans) {
    breakdown[s.decision] = (breakdown[s.decision] ?? 0) + 1;
  }

  // Per-kiosk breakdown
  const kioskMap = new Map<string, { granted: number; denied: number }>();
  for (const s of scans) {
    const k = s.kioskId;
    if (!kioskMap.has(k)) kioskMap.set(k, { granted: 0, denied: 0 });
    const e = kioskMap.get(k)!;
    if (s.decision === "granted") e.granted += 1;
    else if (["denied", "challenge_failed"].includes(s.decision)) e.denied += 1;
  }
  const byKiosk = Array.from(kioskMap.entries()).map(([kioskId, v]) => ({
    kioskId,
    ...v,
  }));

  // Match-score distribution (granted only, 10 bins 0.5–1.0)
  const bins = Array.from({ length: 10 }, (_, i) => ({
    bin: (0.5 + i * 0.05).toFixed(2),
    count: 0,
  }));
  for (const s of scans) {
    if (s.decision === "granted" && s.faceMatchScore != null) {
      const idx = Math.min(
        9,
        Math.max(0, Math.floor((s.faceMatchScore - 0.5) / 0.05))
      );
      bins[idx].count += 1;
    }
  }

  // Avg latency for granted
  const grantedScans = scans.filter((s) => s.decision === "granted");
  const avgLatency =
    grantedScans.length > 0
      ? Math.round(
          grantedScans.reduce((a, s) => a + (s.latencyMs ?? 0), 0) /
            grantedScans.length
        )
      : 0;
  const avgScore =
    grantedScans.length > 0
      ? grantedScans.reduce((a, s) => a + (s.faceMatchScore ?? 0), 0) /
        grantedScans.length
      : 0;
  const offlineCount = scans.filter((s) => s.offline).length;

  return NextResponse.json({
    totalScans: scans.length,
    granted: breakdown.granted ?? 0,
    denied: (breakdown.denied ?? 0) + (breakdown.challenge_failed ?? 0),
    grantRate:
      scans.length > 0
        ? (breakdown.granted ?? 0) / scans.length
        : 0,
    avgLatencyMs: avgLatency,
    avgMatchScore: avgScore,
    offlineCount,
    daily,
    byKiosk,
    scoreDistribution: bins,
    recent: scans.slice(0, 10).map((s) => ({
      id: s.id,
      kioskId: s.kioskId,
      decision: s.decision,
      faceMatchStatus: s.faceMatchStatus,
      faceMatchScore: s.faceMatchScore,
      latencyMs: s.latencyMs,
      offline: s.offline,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}
