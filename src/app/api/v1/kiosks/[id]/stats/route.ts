import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

// Per-kiosk analytics: daily scan counts (30d), decision breakdown,
// match-score distribution, latency stats, offline count, recent scans,
// top employees by scan count.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if (auth.response) return auth.response;

  const { id } = await params;
  const kiosk = await db.kiosk.findUnique({ where: { id } });
  if (!kiosk) {
    return NextResponse.json({ error: "Kiosk not found" }, { status: 404 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setUTCHours(0, 0, 0, 0);

  const scans = await db.scanEvent.findMany({
    where: { kioskId: kiosk.kioskId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      decision: true,
      faceMatchScore: true,
      faceMatchStatus: true,
      latencyMs: true,
      offline: true,
      employeeId: true,
      createdAt: true,
    },
  });

  // Daily buckets
  const daily: { date: string; granted: number; denied: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    daily.push({ date: d.toISOString().slice(0, 10), granted: 0, denied: 0 });
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
  for (const s of scans) breakdown[s.decision] = (breakdown[s.decision] ?? 0) + 1;

  // Match-score distribution (granted, bins 0.5-1.0)
  const bins = Array.from({ length: 10 }, (_, i) => ({
    bin: (0.5 + i * 0.05).toFixed(2),
    count: 0,
  }));
  for (const s of scans) {
    if (s.decision === "granted" && s.faceMatchScore != null) {
      const idx = Math.min(9, Math.max(0, Math.floor((s.faceMatchScore - 0.5) / 0.05)));
      bins[idx].count += 1;
    }
  }

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
  const p95Latency = (() => {
    const lats = grantedScans
      .map((s) => s.latencyMs ?? 0)
      .sort((a, b) => a - b);
    if (lats.length === 0) return 0;
    const idx = Math.min(lats.length - 1, Math.floor(lats.length * 0.95));
    return lats[idx] ?? 0;
  })();

  // Top employees
  const empCounts = new Map<string, number>();
  for (const s of scans) {
    if (s.employeeId) empCounts.set(s.employeeId, (empCounts.get(s.employeeId) ?? 0) + 1);
  }
  const topEmpIds = Array.from(empCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  const emps = topEmpIds.length
    ? await db.employee.findMany({
        where: { id: { in: topEmpIds } },
        select: { id: true, employeeCode: true, fullName: true, photoUrl: true },
      })
    : [];
  const empMap = new Map(emps.map((e) => [e.id, e]));
  const topEmployees = topEmpIds.map((id) => ({
    ...empMap.get(id),
    scanCount: empCounts.get(id) ?? 0,
  }));

  return NextResponse.json({
    kioskId: kiosk.kioskId,
    name: kiosk.name,
    location: kiosk.location,
    status: kiosk.status,
    thresholds: {
      granted: kiosk.thresholdGranted,
      challenge: kiosk.thresholdChallenge,
    },
    challengeMode: kiosk.challengeMode,
    crlVersion: kiosk.crlVersion,
    lastSyncAt: kiosk.lastSyncAt?.toISOString() ?? null,
    totalScans: scans.length,
    granted: breakdown.granted ?? 0,
    denied: (breakdown.denied ?? 0) + (breakdown.challenge_failed ?? 0),
    grantRate: scans.length > 0 ? (breakdown.granted ?? 0) / scans.length : 0,
    avgLatencyMs: avgLatency,
    p95LatencyMs: p95Latency,
    avgMatchScore: avgScore,
    offlineCount,
    daily,
    scoreDistribution: bins,
    topEmployees,
    recent: scans.slice(0, 8).map((s) => ({
      id: s.id,
      decision: s.decision,
      faceMatchStatus: s.faceMatchStatus,
      faceMatchScore: s.faceMatchScore,
      latencyMs: s.latencyMs,
      offline: s.offline,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}
