import { NextRequest } from "next/server";
import {
  requireAuth,
  createSession,
  destroySession,
  extractBearer,
  ok,
} from "@/lib/auth-runtime";
import { db } from "@/lib/db";
import type { AdminUserDTO, AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  // Re-fetch the admin from DB to refresh role/fields.
  const admin = await db.adminUser.findUnique({
    where: { id: session!.adminId },
  });
  if (!admin) {
    // Destroy the dangling session.
    await destroySession(extractBearer(req));
    return ok({ ok: false }, 401);
  }

  // Re-issue: destroys the previous token (single-active) and mints a fresh one
  // with a renewed TTL.
  const newToken = await createSession({
    id: admin.id,
    email: admin.email,
    role: admin.role as AdminRole,
    name: admin.name,
  });

  const dto: AdminUserDTO = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role as AdminRole,
    createdAt: admin.createdAt.toISOString(),
  };

  return ok({ token: newToken, admin: dto });
}
