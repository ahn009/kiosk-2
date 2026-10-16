import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-runtime";
import { emitAlert } from "@/lib/emit-alert";
import { cosineSimilarity, generateEmbedding, simulateProbe, normalize } from "@/lib/crypto";
import { requireDemoMode } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

// Simulate a full kiosk scan: pick a random enrolled employee, run a simulated
// face match against their stored embedding, write an immutable ScanEvent to
// the audit trail, and emit a real-time alert. Used by the command palette's
// "Simulate scan" action to demonstrate the live pipeline end-to-end.
// DEMO ONLY — returns 404 unless DEMO_MODE is enabled.
export async function POST(req: NextRequest) {
  const demoBlocked = requireDemoMode();
  if (demoBlocked) return demoBlocked;
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const kioskId = url.searchParams.get("kioskId") || "KSK-001";
  const force = url.searchParams.get("decision"); // "granted" | "denied" | undefined (random)

  // Pick a random enrolled employee
  const enrolled = await db.employee.findMany({
    where: {
      faceEmbedding: { not: null },
      cardStatus: "active",
      fullName: { not: "Deleted User" },
    },
    select: { id: true, employeeCode: true, fullName: true, faceEmbedding: true },
  });
  if (enrolled.length === 0) {
    return NextResponse.json({ error: "No enrolled employees" }, { status: 404 });
  }
  const emp = enrolled[Math.floor(Math.random() * enrolled.length)];

  // Run a simulated face match
  const enrolledVec = JSON.parse(emp.faceEmbedding!) as number[];
  // 85% chance of a good probe (granted), 15% bad (denied) unless forced
  const wantGranted = force ? force === "granted" : Math.random() < 0.85;
  const probe = wantGranted
    ? simulateProbe(enrolledVec, true) // small noise → high similarity
    : generateEmbedding("impostor-" + Math.random()); // unrelated → low similarity
  const matchScore = cosineSimilarity(probe, enrolledVec);

  // Fetch kiosk thresholds
  const kiosk = await db.kiosk.findUnique({ where: { kioskId } });
  const thresholdGranted = kiosk?.thresholdGranted ?? 0.85;
  const thresholdChallenge = kiosk?.thresholdChallenge ?? 0.6;

  let decision: string;
  let faceMatchStatus: string;
  if (matchScore >= thresholdGranted) {
    decision = "granted";
    faceMatchStatus = "match";
  } else if (matchScore >= thresholdChallenge) {
    decision = "granted"; // challenge path → grant for demo
    faceMatchStatus = "match";
  } else {
    decision = "denied";
    faceMatchStatus = "mismatch";
  }

  // Override if forced
  if (force === "denied" && decision === "granted") {
    decision = "denied";
    faceMatchStatus = "mismatch";
  }
  if (force === "granted" && decision === "denied") {
    decision = "granted";
    faceMatchStatus = "match";
  }

  const latencyMs = 600 + Math.floor(Math.random() * 1200);
  const snapshotPath = `kiosk:${kioskId}/sim-${Date.now()}`;

  // Write immutable audit row
  const scan = await db.scanEvent.create({
    data: {
      kioskId,
      employeeId: emp.id,
      faceMatchScore: matchScore,
      faceMatchStatus,
      spoofFlags: decision === "denied" && Math.random() > 0.7 ? JSON.stringify({ paper_detected: true }) : null,
      decision,
      snapshotPath,
      latencyMs,
      offline: false,
    },
  });

  // Emit real-time alert
  const severity = decision === "granted" ? "info" : "warning";
  const title = decision === "granted" ? "Access granted" : "Access denied";
  const message = `${emp.fullName} (${emp.employeeCode}) · ${decision} · score ${(matchScore * 100).toFixed(0)}%`;
  emitAlert({
    type: "scan",
    severity,
    title,
    message,
    kioskId,
    employeeCode: emp.employeeCode,
    timestamp: new Date().toISOString(),
  });

  // If spoof detected, also emit a spoof alert
  if (decision === "denied" && Math.random() > 0.7) {
    emitAlert({
      type: "spoof",
      severity: "critical",
      title: "Spoof attempt detected",
      message: `Paper/photo spoof at ${kioskId} for ${emp.fullName} (${emp.employeeCode}).`,
      kioskId,
      employeeCode: emp.employeeCode,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    scanId: scan.id,
    kioskId,
    employee: { code: emp.employeeCode, name: emp.fullName },
    decision,
    faceMatchStatus,
    matchScore: Number(matchScore.toFixed(4)),
    latencyMs,
    snapshotPath,
  });
}
