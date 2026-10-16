import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth } from "@/lib/auth-runtime";
import { toKioskDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const rows = await db.kiosk.findMany({
    orderBy: { kioskId: "asc" },
  });

  return ok(rows.map(toKioskDTO));
}
