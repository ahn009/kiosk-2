import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth } from "@/lib/auth-runtime";
import { toScanEventDTO } from "@/lib/mappers";
import type { DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const todayStart = startOfTodayUTC();

  const [state, totalEmployees, enrolledEmployees, totalKiosks, activeKiosks, scansTodayRows] =
    await Promise.all([
      db.systemState.findUnique({ where: { id: "singleton" } }),
      db.employee.count({ where: { fullName: { not: "Deleted User" } } }),
      db.employee.count({
        where: {
          faceEmbedding: { not: null },
          fullName: { not: "Deleted User" },
        },
      }),
      db.kiosk.count(),
      db.kiosk.count({ where: { status: "online" } }),
      db.scanEvent.findMany({
        where: { createdAt: { gte: todayStart } },
        include: { employee: { select: { fullName: true, employeeCode: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const scansToday = scansTodayRows.length;
  const grantedToday = scansTodayRows.filter((s) => s.decision === "granted").length;
  const deniedToday = scansTodayRows.filter((s) =>
    ["denied", "challenge_failed"].includes(s.decision)
  ).length;
  const spoofAttemptsToday = scansTodayRows.filter(
    (s) => s.spoofFlags && s.decision !== "granted"
  ).length;
  const grantRate = scansToday > 0 ? grantedToday / scansToday : 0;

  // scansByHour — 24 buckets
  const scansByHour: { hour: number; count: number }[] = Array.from(
    { length: 24 },
    (_, h) => ({ hour: h, count: 0 })
  );
  for (const s of scansTodayRows) {
    const h = new Date(s.createdAt).getHours();
    scansByHour[h].count += 1;
  }

  // scansByKiosk — group all scans today by kiosk
  const kiosks = await db.kiosk.findMany();
  const scansByKiosk: DashboardStats["scansByKiosk"] = kiosks.map((k) => {
    const ks = scansTodayRows.filter((s) => s.kioskId === k.kioskId);
    return {
      kioskId: k.kioskId,
      name: k.name,
      count: ks.length,
      denied: ks.filter((s) => s.decision !== "granted").length,
    };
  });

  // recentDenials — last 5 denied
  const recentDenialsRows = scansTodayRows
    .filter((s) => s.decision !== "granted")
    .slice(0, 5);
  const recentDenials = recentDenialsRows.map(toScanEventDTO);

  // FRR ≈ denied among known-employee scans / total known-employee scans today
  const knownScans = scansTodayRows.filter((s) => s.employeeId !== null);
  const knownDenied = knownScans.filter(
    (s) => s.decision === "denied" || s.decision === "challenge_failed"
  ).length;
  const frr = knownScans.length > 0 ? knownDenied / knownScans.length : 0;
  // FAR cannot be measured from scan logs alone: it requires ground-truth
  // labels of which "granted" scans were actually impostors. Report null
  // (unknown) rather than a fabricated 0. A real value comes from the
  // calibration study (roadmap Phase 5).
  const far: number | null = null;

  const stats: DashboardStats = {
    scansToday,
    grantedToday,
    deniedToday,
    grantRate: Number(grantRate.toFixed(4)),
    activeKiosks,
    totalKiosks,
    totalEmployees,
    enrolledEmployees,
    lockdownActive: !!state?.lockdownActive,
    spoofAttemptsToday,
    scansByHour,
    scansByKiosk,
    recentDenials,
    frr: Number(frr.toFixed(4)),
    far,
  };

  return ok(stats);
}
