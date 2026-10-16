import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const rows = await db.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return ok(rows);
}
