import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public kiosk registry (launcher, pre-auth). Returns only non-sensitive
// fields: kioskId, name, location, status. No thresholds / config.
export async function GET() {
  const rows = await db.kiosk.findMany({
    orderBy: { kioskId: "asc" },
    select: {
      kioskId: true,
      name: true,
      location: true,
      status: true,
    },
  });
  return NextResponse.json(rows);
}
