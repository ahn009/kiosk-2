import { NextRequest } from "next/server";
import { ok, fail, requireRole, parseBody } from "@/lib/auth-runtime";
import { requireDemoMode } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/calibration
 *
 * Runs a simulated ROC calibration for a kiosk. In production this script
 * runs against real captured embeddings (genuine vs impostor similarity
 * distributions); here it uses simulated Gaussian distributions for
 * demonstration. Do NOT hardcode thresholds — they should be calibrated per
 * deployment.
 *
 * Body:
 *   { kioskId: string, genuineCount?: number, impostorCount?: number }
 *   (counts default to 50 / 50)
 *
 * Returns:
 *   {
 *     kioskId,
 *     genuineScores: number[],
 *     impostorScores: number[],
 *     roc: [{ threshold, far, frr }],
 *     optimalThreshold,
 *     summary: { genuineCount, impostorCount, meanGenuine, meanImpostor, auc }
 *   }
 *
 * optimalThreshold = the lowest threshold where FAR <= 0.001 (0.1%);
 *   if none satisfies, pick the threshold minimizing (FAR + FRR).
 * auc = trapezoidal area under the TPR-vs-FAR ROC curve.
 */

// Box-Muller transform — generates a standard-normal sample from two
// uniform [0,1) samples.
function gaussian(mean: number, std: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

interface RocPoint {
  threshold: number;
  far: number;
  frr: number;
}

interface CalibrationResponse {
  kioskId: string;
  genuineScores: number[];
  impostorScores: number[];
  roc: RocPoint[];
  optimalThreshold: number;
  summary: {
    genuineCount: number;
    impostorCount: number;
    meanGenuine: number;
    meanImpostor: number;
    auc: number;
  };
}

function computeRoc(
  genuineScores: number[],
  impostorScores: number[],
): { roc: RocPoint[]; optimalThreshold: number; auc: number } {
  const roc: RocPoint[] = [];
  // thresholds 0.0 → 1.0 step 0.01
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const threshold = Math.round(t * 100) / 100;
    const far =
      impostorScores.length === 0
        ? 0
        : impostorScores.filter((s) => s >= threshold).length /
          impostorScores.length;
    const frr =
      genuineScores.length === 0
        ? 0
        : genuineScores.filter((s) => s < threshold).length /
          genuineScores.length;
    roc.push({ threshold, far, frr });
  }

  // optimalThreshold: lowest threshold where FAR <= 0.001 (0.1%).
  // If none satisfies, pick the one minimising (FAR + FRR).
  const farTarget = 0.001;
  const satisfying = roc.filter((p) => p.far <= farTarget);
  let optimalThreshold: number;
  if (satisfying.length > 0) {
    // pick the lowest threshold (most permissive) satisfying FAR <= 0.001
    optimalThreshold = satisfying[0].threshold;
  } else {
    let best = roc[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const p of roc) {
      const score = p.far + p.frr;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    optimalThreshold = best.threshold;
  }

  // AUC — trapezoidal integration of TPR (1 - FRR) over FAR (sorted asc).
  const sorted = [...roc].sort((a, b) => a.far - b.far);
  let auc = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const x1 = sorted[i].far;
    const x2 = sorted[i + 1].far;
    const y1 = 1 - sorted[i].frr;
    const y2 = 1 - sorted[i + 1].frr;
    auc += ((x2 - x1) * (y1 + y2)) / 2;
  }
  // Clamp to [0, 1] (numerical safety).
  auc = Math.max(0, Math.min(1, auc));

  return { roc, optimalThreshold, auc };
}

export async function POST(req: NextRequest) {
  // Simulated ROC calibration — demo only. Real calibration runs against
  // measured genuine/impostor distributions (see PRODUCTION_ROADMAP Phase 5).
  const demoBlocked = requireDemoMode();
  if (demoBlocked) return demoBlocked;
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const body = await parseBody<{
    kioskId?: string;
    genuineCount?: number;
    impostorCount?: number;
  }>(req);

  if (!body || !body.kioskId || typeof body.kioskId !== "string") {
    return fail("kioskId is required", 400);
  }

  const genuineCount = Math.max(
    1,
    Math.min(500, Math.floor(body.genuineCount ?? 50)),
  );
  const impostorCount = Math.max(
    1,
    Math.min(500, Math.floor(body.impostorCount ?? 50)),
  );

  // Simulate genuine scores ~ Normal(0.92, 0.05), clamped [0,1].
  // Simulate impostor scores ~ Normal(0.35, 0.12), clamped [0,1].
  const genuineScores: number[] = [];
  const impostorScores: number[] = [];
  for (let i = 0; i < genuineCount; i++) {
    genuineScores.push(clamp01(gaussian(0.92, 0.05)));
  }
  for (let i = 0; i < impostorCount; i++) {
    impostorScores.push(clamp01(gaussian(0.35, 0.12)));
  }

  const meanGenuine =
    genuineScores.reduce((a, b) => a + b, 0) / genuineScores.length;
  const meanImpostor =
    impostorScores.reduce((a, b) => a + b, 0) / impostorScores.length;

  const { roc, optimalThreshold, auc } = computeRoc(
    genuineScores,
    impostorScores,
  );

  const response: CalibrationResponse = {
    kioskId: body.kioskId,
    genuineScores,
    impostorScores,
    roc,
    optimalThreshold,
    summary: {
      genuineCount,
      impostorCount,
      meanGenuine: Number(meanGenuine.toFixed(4)),
      meanImpostor: Number(meanImpostor.toFixed(4)),
      auc: Number(auc.toFixed(4)),
    },
  };

  return ok(response);
}
