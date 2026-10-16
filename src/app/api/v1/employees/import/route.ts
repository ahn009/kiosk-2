import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sha256, buildToken } from "@/lib/crypto";
import {
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";
import type { AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: AdminRole[] = ["hr_admin", "security_officer", "superadmin"];

interface ImportRow {
  employeeCode: string;
  fullName: string;
  departmentCode?: string;
  designation?: string;
  accessLevel?: number;
}

interface RowError {
  row: number;
  message: string;
}

interface Created {
  id: string;
  employeeCode: string;
  fullName: string;
  cardToken: string;
}

interface Skipped {
  row: number;
  employeeCode: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ALLOWED_ROLES);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const body = await parseBody<{ rows?: ImportRow[] }>(req);
  if (!body || !Array.isArray(body.rows)) {
    return fail("Body must be { rows: [...] }", 400);
  }
  const rows = body.rows;

  if (rows.length === 0) {
    return fail("No rows provided", 400);
  }
  if (rows.length > 500) {
    return fail("Too many rows (max 500 per import)", 400);
  }

  // ---- Pre-fetch all departments once (code -> id) ----
  const allDepts = await db.department.findMany({ select: { id: true, code: true } });
  const deptByCode = new Map(allDepts.map((d) => [d.code.toUpperCase(), d.id]));

  // ---- Load system state for token minting ----
  const state = await db.systemState.findUnique({ where: { id: "singleton" } });
  const orgCode = state?.orgCode ?? "ACME";
  const expEpoch = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2; // +2y

  // ---- Validate each row ----
  const errors: RowError[] = [];
  const skipped: Skipped[] = [];
  const seenCodes = new Set<string>();
  const validRows: Array<{
    row: number;
    employeeCode: string;
    fullName: string;
    departmentId: string | null;
    designation: string | null;
    accessLevel: number;
  }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const rowNum = i + 1;
    const code = (r?.employeeCode ?? "").toString().trim();
    const name = (r?.fullName ?? "").toString().trim();
    const deptCode = (r?.departmentCode ?? "").toString().trim();
    const designation = (r?.designation ?? "").toString().trim() || null;
    const accessLevelRaw = r?.accessLevel;

    if (!code && !name) {
      errors.push({ row: rowNum, message: "Empty row — missing employeeCode and fullName" });
      continue;
    }
    if (!code) {
      errors.push({ row: rowNum, message: "Missing employeeCode" });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNum, message: "Missing fullName" });
      continue;
    }

    let accessLevel = 1;
    if (accessLevelRaw !== undefined && accessLevelRaw !== null && accessLevelRaw !== ("" as unknown)) {
      const n = Number(accessLevelRaw);
      if (!Number.isFinite(n) || n < 1 || n > 5 || !Number.isInteger(n)) {
        errors.push({ row: rowNum, message: `Access level must be an integer 1-5 (got "${accessLevelRaw}")` });
        continue;
      }
      accessLevel = n;
    }

    let departmentId: string | null = null;
    if (deptCode) {
      const found = deptByCode.get(deptCode.toUpperCase());
      if (!found) {
        errors.push({ row: rowNum, message: `Department code not found: "${deptCode}"` });
        continue;
      }
      departmentId = found;
    }

    if (seenCodes.has(code.toLowerCase())) {
      errors.push({ row: rowNum, message: `Duplicate employeeCode in batch: "${code}"` });
      continue;
    }
    seenCodes.add(code.toLowerCase());

    validRows.push({
      row: rowNum,
      employeeCode: code,
      fullName: name,
      departmentId,
      designation,
      accessLevel,
    });
  }

  // ---- Check duplicates vs existing employees ----
  // Active duplicates → skip. Soft-deleted (fullName="Deleted User") with the
  // same code → reactivate instead of create (employeeCode is @unique).
  const reactivateIds = new Map<string, string>(); // lowercase code → existing employee id
  if (validRows.length > 0) {
    const codes = validRows.map((r) => r.employeeCode);
    const existing = await db.employee.findMany({
      where: { employeeCode: { in: codes } },
      select: { id: true, employeeCode: true, fullName: true },
    });
    const activeSet = new Set(
      existing
        .filter((e) => e.fullName !== "Deleted User")
        .map((e) => e.employeeCode.toLowerCase())
    );
    const deletedByCode = new Map(
      existing
        .filter((e) => e.fullName === "Deleted User")
        .map((e) => [e.employeeCode.toLowerCase(), e.id])
    );
    const stillValid: typeof validRows = [];
    for (const v of validRows) {
      const lc = v.employeeCode.toLowerCase();
      if (activeSet.has(lc)) {
        skipped.push({
          row: v.row,
          employeeCode: v.employeeCode,
          reason: "Employee code already exists",
        });
      } else {
        stillValid.push(v);
        if (deletedByCode.has(lc)) {
          reactivateIds.set(lc, deletedByCode.get(lc)!);
        }
      }
    }
    validRows.splice(0, validRows.length, ...stillValid);
  }

  // ---- Create / reactivate all valid rows in a transaction ----
  const created: Created[] = [];
  if (validRows.length > 0) {
    await db.$transaction(async (tx) => {
      for (const v of validRows) {
        const { token } = buildToken({ orgCode, expEpoch });
        const cardTokenHash = sha256(token);
        const lc = v.employeeCode.toLowerCase();
        const existingId = reactivateIds.get(lc);
        let emp: { id: string; employeeCode: string; fullName: string };
        if (existingId) {
          // Reactivate the soft-deleted record (revoke its old card first)
          const oldRow = await tx.employee.findUnique({ where: { id: existingId } });
          if (oldRow?.cardTokenHash) {
            await tx.revocation.upsert({
              where: { tokenHash: oldRow.cardTokenHash },
              update: {},
              create: { tokenHash: oldRow.cardTokenHash, reason: "Reissued during CSV bulk import reactivation" },
            });
          }
          emp = await tx.employee.update({
            where: { id: existingId },
            data: {
              fullName: v.fullName,
              departmentId: v.departmentId,
              designation: v.designation,
              accessLevel: v.accessLevel,
              cardTokenHash,
              cardStatus: "active",
              cardExpiresAt: new Date(expEpoch * 1000),
            },
          });
        } else {
          emp = await tx.employee.create({
            data: {
              employeeCode: v.employeeCode,
              fullName: v.fullName,
              departmentId: v.departmentId,
              designation: v.designation,
              accessLevel: v.accessLevel,
              cardTokenHash,
              cardStatus: "active",
              cardExpiresAt: new Date(expEpoch * 1000),
            },
          });
        }
        created.push({
          id: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          cardToken: token,
        });
      }
    });

    await logAdminAction({
      actorId: session.adminId,
      target: "employees:bulk",
      action: "employee.bulk_import",
      after: { count: created.length, skipped: skipped.length, errors: errors.length },
    });
  }

  return ok({
    successCount: created.length,
    errorCount: errors.length,
    errors,
    created,
    skipped,
  });
}
