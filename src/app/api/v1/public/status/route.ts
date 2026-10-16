import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";

// Public system status (launcher, pre-auth). Returns lockdown flag + org info.
// demoMode tells kiosk/admin UIs whether demo affordances (demo card picker,
// simulators) may be shown. No secrets are exposed here.
export async function GET() {
  const state = await db.systemState.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    lockdownActive: state?.lockdownActive ?? false,
    lockdownReason: state?.lockdownReason ?? null,
    orgCode: state?.orgCode ?? "ACME",
    orgName: state?.orgName ?? "Acme Corporation",
    demoMode: demoModeEnabled(),
  });
}
