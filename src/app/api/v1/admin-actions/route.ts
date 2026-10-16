import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireRole } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const action = url.searchParams.get("action") || undefined;
  const actorId = url.searchParams.get("actor_id") || undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (actorId) where.actorId = actorId;

  const [total, rows] = await Promise.all([
    db.adminAction.count({ where }),
    db.adminAction.findMany({
      where,
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const items = rows.map((r) => {
    let before: unknown = null;
    let after: unknown = null;
    try {
      if (r.beforeData) before = JSON.parse(r.beforeData);
    } catch {
      before = r.beforeData;
    }
    try {
      if (r.afterData) after = JSON.parse(r.afterData);
    } catch {
      after = r.afterData;
    }
    return {
      id: r.id,
      actorId: r.actorId,
      actorEmail: r.actor?.email ?? null,
      actorName: r.actor?.name ?? null,
      target: r.target,
      action: r.action,
      before,
      after,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return ok({
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
