import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireRole } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const revs = await db.revocation.findMany({
    orderBy: { revokedAt: "desc" },
  });

  // Map tokenHash → employee
  const tokenHashes = revs.map((r) => r.tokenHash);
  const employees = await db.employee.findMany({
    where: { cardTokenHash: { in: tokenHashes } },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      cardTokenHash: true,
      cardStatus: true,
    },
  });
  const empByHash = new Map(employees.map((e) => [e.cardTokenHash, e]));

  const items = revs.map((r) => {
    const emp = empByHash.get(r.tokenHash);
    return {
      tokenHash: r.tokenHash,
      reason: r.reason,
      revokedAt: r.revokedAt.toISOString(),
      employeeName: emp?.fullName ?? null,
      employeeCode: emp?.employeeCode ?? null,
      employee: emp
        ? {
            id: emp.id,
            employeeCode: emp.employeeCode,
            fullName: emp.fullName,
            cardStatus: emp.cardStatus,
          }
        : null,
    };
  });

  return ok(items);
}
