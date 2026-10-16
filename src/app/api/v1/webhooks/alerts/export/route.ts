import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

// GET — export scan events as JSON (for SIEM ingestion) or CSV.
// Query: ?format=json|csv&from=&to=&decision=&kiosk_id=&limit=1000
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const decision = url.searchParams.get("decision") || undefined;
  const kioskId = url.searchParams.get("kiosk_id") || undefined;
  const limit = Math.min(
    10000,
    Math.max(1, Number(url.searchParams.get("limit") ?? "1000") || 1000)
  );

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as { gte?: Date }).gte = new Date(from);
    if (to) (where.createdAt as { lte?: Date }).lte = new Date(to);
  }
  if (decision) where.decision = decision;
  if (kioskId) where.kioskId = kioskId;

  const events = await db.scanEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { employee: { select: { employeeCode: true, fullName: true } } },
  });

  const rows = events.map((e) => ({
    id: e.id,
    timestamp: e.createdAt.toISOString(),
    kiosk_id: e.kioskId,
    employee_code: e.employee?.employeeCode ?? null,
    employee_name: e.employee?.fullName ?? null,
    token_hash: e.tokenHash,
    decision: e.decision,
    face_match_status: e.faceMatchStatus,
    face_match_score: e.faceMatchScore,
    spoof_flags: e.spoofFlags,
    latency_ms: e.latencyMs,
    offline: e.offline,
    snapshot_path: e.snapshotPath,
  }));

  if (format === "csv") {
    const headers = [
      "id",
      "timestamp",
      "kiosk_id",
      "employee_code",
      "employee_name",
      "decision",
      "face_match_status",
      "face_match_score",
      "latency_ms",
      "offline",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.timestamp,
          `"${r.kiosk_id}"`,
          r.employee_code ? `"${r.employee_code}"` : "",
          r.employee_name ? `"${r.employee_name.replace(/"/g, '""')}"` : "",
          r.decision,
          r.face_match_status ?? "",
          r.face_match_score ?? "",
          r.latency_ms ?? "",
          r.offline ? "true" : "false",
        ].join(",")
      ),
    ].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sentinelkiosk-audit-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    count: rows.length,
    events: rows,
  });
}
