import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/crypto";
import { createSession, parseBody, ok, fail } from "@/lib/auth-runtime";
import {
  checkRateLimit,
  rateLimited,
  clientIp,
  LOGIN_LIMIT,
} from "@/lib/rate-limit";
import type { AdminRole, AdminUserDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(
    `login:${clientIp(req)}`,
    LOGIN_LIMIT.max,
    LOGIN_LIMIT.windowMs,
  );
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  const body = await parseBody<{ email?: string; password?: string }>(req);
  if (!body?.email || !body?.password) {
    return fail("Missing email or password", 400);
  }

  const admin = await db.adminUser.findUnique({
    where: { email: body.email.toLowerCase() },
  });
  if (!admin) {
    return fail("Invalid credentials", 401);
  }

  const valid = verifySecret(body.password, admin.passwordHash);
  if (!valid) {
    return fail("Invalid credentials", 401);
  }

  const token = await createSession({
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

  return ok({ token, admin: dto });
}
