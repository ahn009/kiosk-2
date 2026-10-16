// Demo-mode guard. Demo-only routes (credential minting, simulators,
// simulated biometrics) must not exist in a production artifact: they return
// 404 when DEMO_MODE is off, so scanners and crawlers can't discover them.
import { NextResponse } from "next/server";
import { demoModeEnabled } from "./config";

/** Returns a 404 response when demo mode is off, else null (allowed). */
export function requireDemoMode(): NextResponse | null {
  if (demoModeEnabled()) return null;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
