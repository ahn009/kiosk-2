import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseBody, ok } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await parseBody<{
    kioskId?: string;
    events?: Array<{
      kioskId: string;
      employeeId?: string | null;
      tokenHash?: string | null;
      faceMatchScore?: number | null;
      faceMatchStatus?: string;
      spoofFlags?: Record<string, unknown> | null;
      decision: string;
      snapshotPath?: string | null;
      latencyMs?: number | null;
      offline?: boolean;
      createdAt: string;
    }>;
    crlVersion?: number;
  }>(req);

  if (!body?.kioskId) {
    return ok({ error: "Missing kioskId" }, 400);
  }

  // Mark kiosk lastSyncAt
  await db.kiosk.updateMany({
    where: { kioskId: body.kioskId },
    data: { lastSyncAt: new Date() },
  });

  let synced = 0;
  for (const ev of body.events ?? []) {
    // Idempotency: skip if tokenHash+createdAt already exists
    if (ev.tokenHash && ev.createdAt) {
      const exists = await db.scanEvent.findFirst({
        where: {
          tokenHash: ev.tokenHash,
          createdAt: new Date(ev.createdAt),
        },
        select: { id: true },
      });
      if (exists) continue;
    }

    await db.scanEvent.create({
      data: {
        kioskId: ev.kioskId,
        employeeId: ev.employeeId ?? null,
        tokenHash: ev.tokenHash ?? null,
        faceMatchScore: ev.faceMatchScore ?? null,
        faceMatchStatus: ev.faceMatchStatus ?? "no_face",
        spoofFlags: ev.spoofFlags ? JSON.stringify(ev.spoofFlags) : null,
        decision: ev.decision,
        snapshotPath: ev.snapshotPath ?? null,
        latencyMs: ev.latencyMs ?? null,
        offline: ev.offline ?? true,
        createdAt: ev.createdAt ? new Date(ev.createdAt) : new Date(),
      },
    });
    synced += 1;
  }

  // Compute revocations delta (newer than client crlVersion)
  const clientCrl = body.crlVersion ?? 0;
  const state = await db.systemState.findUnique({ where: { id: "singleton" } });
  const latestCrl = state?.crlVersion ?? 1;

  let revocations: { tokenHash: string; reason: string | null; revokedAt: string }[] = [];
  if (clientCrl < latestCrl) {
    const all = await db.revocation.findMany({
      orderBy: { revokedAt: "asc" },
    });
    revocations = all.map((r) => ({
      tokenHash: r.tokenHash,
      reason: r.reason,
      revokedAt: r.revokedAt.toISOString(),
    }));
  }

  return ok({
    synced,
    crlVersion: latestCrl,
    revocations,
  });
}
