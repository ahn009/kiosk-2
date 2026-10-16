import { NextRequest, NextResponse } from "next/server";
import {
  getWebhookState,
  saveWebhookTarget,
  deleteWebhookTarget,
  setGlobalEnabled,
  type WebhookTarget,
} from "@/lib/webhook-store";
import { requireRole, parseBody, logAdminAction } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

// GET — list webhook config + stats. Secrets are never returned;
// targets carry `hasSecret` instead.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const state = await getWebhookState();
  return NextResponse.json(state);
}

// POST — create or update a webhook target.
// Body: { id?, name, url, type, enabled, secret?, clearSecret?, events[] }
// The URL is SSRF-checked; a supplied secret is encrypted at rest and never
// returned. Omit `secret` to keep the existing one.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const body = await parseBody<{
    id?: string;
    name?: string;
    url?: string;
    type?: string;
    enabled?: boolean;
    secret?: string;
    clearSecret?: boolean;
    events?: string[];
  }>(req);

  if (!body?.name || !body?.url) {
    return NextResponse.json(
      { error: "name and url are required" },
      { status: 400 }
    );
  }
  if (!["slack", "teams", "generic", "email"].includes(body.type ?? "")) {
    return NextResponse.json(
      { error: "type must be slack|teams|generic|email" },
      { status: 400 }
    );
  }
  if (body.secret && body.secret.length > 512) {
    return NextResponse.json(
      { error: "secret too long (max 512 chars)" },
      { status: 400 }
    );
  }

  try {
    const state = await saveWebhookTarget({
      id: body.id,
      name: body.name,
      url: body.url,
      type: body.type as WebhookTarget["type"],
      enabled: body.enabled ?? true,
      secret: body.secret || undefined,
      clearSecret: body.clearSecret === true,
      events: body.events ?? ["denied", "lockdown", "spoof", "supervisor_override"],
    });
    await logAdminAction({
      actorId: auth.session!.adminId,
      target: `webhook:${body.id ?? "new"}`,
      action: "webhook.target.save",
      after: { name: body.name, url: body.url, type: body.type },
    });
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save webhook";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// PATCH — toggle global enabled. Body: { globalEnabled: boolean }
export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const body = await parseBody<{ globalEnabled?: boolean }>(req);
  if (body?.globalEnabled === undefined) {
    return NextResponse.json({ error: "globalEnabled required" }, { status: 400 });
  }
  const state = await setGlobalEnabled(body.globalEnabled);
  return NextResponse.json({ ok: true, state });
}

// DELETE — remove a webhook target. ?id=...
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const state = await deleteWebhookTarget(id);
  return NextResponse.json({ ok: true, state });
}
