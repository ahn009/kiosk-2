import { NextRequest } from "next/server";
import { extractBearer, destroySession, ok } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = extractBearer(req);
  await destroySession(token);
  return ok({ ok: true });
}
