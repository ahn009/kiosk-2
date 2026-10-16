import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth } from "@/lib/auth-runtime";
import { toScanEventDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const kioskId = url.searchParams.get("kiosk_id") || undefined;
  const employeeId = url.searchParams.get("employee_id") || undefined;
  const decision = url.searchParams.get("decision") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (kioskId) where.kioskId = kioskId;
  if (employeeId) where.employeeId = employeeId;
  if (decision) where.decision = decision;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  const [total, rows] = await Promise.all([
    db.scanEvent.count({ where }),
    db.scanEvent.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return ok({
    items: rows.map(toScanEventDTO),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
