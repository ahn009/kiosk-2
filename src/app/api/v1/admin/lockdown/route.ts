import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";
import { dispatchAlert } from "@/lib/webhook-store";
import { emitAlert } from "@/lib/emit-alert";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const body = await parseBody<{ reason?: string }>(req);
  if (!body?.reason) {
    return fail("Missing reason", 400);
  }

  const before = await db.systemState.findUnique({ where: { id: "singleton" } });

  const updated = await db.systemState.update({
    where: { id: "singleton" },
    data: {
      lockdownActive: true,
      lockdownReason: body.reason,
      lockdownStartedAt: new Date(),
      crlVersion: { increment: 1 },
    },
  });

  // Put all kiosks into lockdown status
  await db.kiosk.updateMany({
    data: { status: "lockdown" },
  });

  await logAdminAction({
    actorId: session.adminId,
    target: "system:lockdown",
    action: "lockdown.enable",
    before: before
      ? {
          lockdownActive: before.lockdownActive,
          lockdownReason: before.lockdownReason,
        }
      : null,
    after: {
      lockdownActive: updated.lockdownActive,
      lockdownReason: updated.lockdownReason,
      crlVersion: updated.crlVersion,
    },
  });

  // Dispatch critical alert to SIEM webhooks
  dispatchAlert({
    type: "lockdown",
    severity: "critical",
    title: "System lockdown engaged",
    message: `Emergency lockdown activated by ${session.email}. Reason: ${body.reason}. All kiosks set to lockdown mode.`,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  // Push to real-time WebSocket alerts feed for connected dashboards
  emitAlert({
    type: "lockdown",
    severity: "critical",
    title: "System lockdown engaged",
    message: `Emergency lockdown activated by ${session.email}. Reason: ${body.reason}.`,
    timestamp: new Date().toISOString(),
  });

  return ok({
    ok: true,
    lockdownActive: updated.lockdownActive,
    lockdownReason: updated.lockdownReason,
    lockdownStartedAt: updated.lockdownStartedAt?.toISOString() ?? null,
    crlVersion: updated.crlVersion,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const before = await db.systemState.findUnique({ where: { id: "singleton" } });

  const updated = await db.systemState.update({
    where: { id: "singleton" },
    data: {
      lockdownActive: false,
      lockdownReason: null,
      lockdownStartedAt: null,
      crlVersion: { increment: 1 },
    },
  });

  // Restore kiosks to online
  await db.kiosk.updateMany({
    where: { status: "lockdown" },
    data: { status: "online" },
  });

  await logAdminAction({
    actorId: session.adminId,
    target: "system:lockdown",
    action: "lockdown.disable",
    before: before
      ? {
          lockdownActive: before.lockdownActive,
          lockdownReason: before.lockdownReason,
        }
      : null,
    after: {
      lockdownActive: updated.lockdownActive,
      crlVersion: updated.crlVersion,
    },
  });

  // Push real-time alert: lockdown cleared
  emitAlert({
    type: "kiosk_status",
    severity: "info",
    title: "Lockdown cleared",
    message: `Lockdown cleared by ${session.email}. Kiosks restored to online.`,
    timestamp: new Date().toISOString(),
  });

  return ok({ ok: true, lockdownActive: false, crlVersion: updated.crlVersion });
}
