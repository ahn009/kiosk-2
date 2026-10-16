import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildToken, sha256 } from "@/lib/crypto";
import { requireDemoMode } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

// DEMO ONLY — mints a fresh raw QR token for each enrolled active employee so
// the kiosk UI can simulate scanning a real card. In production the raw token
// is NEVER stored server-side; this exists purely to make the kiosk demo
// end-to-end testable. Each call rotates the stored token hash.
// Returns 404 unless DEMO_MODE is enabled.
export async function GET(_req: NextRequest) {
  const demoBlocked = requireDemoMode();
  if (demoBlocked) return demoBlocked;

  const orgState = await db.systemState.findUnique({ where: { id: "singleton" } });
  const orgCode = orgState?.orgCode ?? "ACME";

  const employees = await db.employee.findMany({
    where: {
      faceEmbedding: { not: null },
      cardStatus: "active",
    },
    orderBy: { employeeCode: "asc" },
    take: 30,
  });

  const expEpoch = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2;
  const cards: {
    employeeId: string;
    code: string;
    name: string;
    designation: string | null;
    token: string;
  }[] = [];
  for (const e of employees) {
    const { token } = buildToken({ orgCode, expEpoch });
    const tokenHash = sha256(token);
    await db.employee.update({
      where: { id: e.id },
      data: { cardTokenHash: tokenHash, cardExpiresAt: new Date(expEpoch * 1000) },
    });
    cards.push({
      employeeId: e.id,
      code: e.employeeCode,
      name: e.fullName,
      designation: e.designation,
      token,
    });
  }

  return NextResponse.json({ cards, orgCode });
}
