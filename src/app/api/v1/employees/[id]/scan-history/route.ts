import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth } from "@/lib/auth-runtime";
import { toScanEventDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const { id } = await params;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const emp = await db.employee.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!emp) return fail("Not found", 404);

  const [total, rows] = await Promise.all([
    db.scanEvent.count({ where: { employeeId: id } }),
    db.scanEvent.findMany({
      where: { employeeId: id },
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
      },
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
