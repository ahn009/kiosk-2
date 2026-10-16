import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireRole } from "@/lib/auth-runtime";
import { toAdminUserDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["superadmin"]);
  if (auth.response) return auth.response;

  const rows = await db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
  });

  return ok(rows.map(toAdminUserDTO));
}
