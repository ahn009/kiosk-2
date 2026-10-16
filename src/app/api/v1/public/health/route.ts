import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lightweight health check for uptime monitoring. No auth.
export async function GET() {
  try {
    const start = Date.now();
    // Simple DB ping
    await db.systemState.count();
    const dbLatencyMs = Date.now() - start;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      dbLatencyMs,
      uptime: process.uptime ? Math.round(process.uptime()) : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "degraded",
        error: e instanceof Error ? e.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
