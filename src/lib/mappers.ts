// DTO mapping helpers shared across API routes. Pure functions only.
import type {
  EmployeeDTO,
  EmployeeDetail,
  ScanEventDTO,
  KioskDTO,
  AdminUserDTO,
  CardStatus,
  Decision,
  FaceMatchStatus,
  KioskStatus,
} from "@/lib/types";

type EmployeeRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentId: string | null;
  designation: string | null;
  accessLevel: number;
  photoUrl: string | null;
  faceEmbedding: string | null;
  faceEnrolledAt: Date | null;
  faceConsentAt: Date | null;
  cardTokenHash: string | null;
  cardStatus: string;
  cardExpiresAt: Date | null;
  pinHash: string | null;
  createdAt: Date;
  department?: { name: string } | null;
};

export function toEmployeeDTO(e: EmployeeRow): EmployeeDTO {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    departmentId: e.departmentId,
    departmentName: e.department?.name ?? null,
    designation: e.designation,
    accessLevel: e.accessLevel,
    photoUrl: e.photoUrl,
    cardStatus: e.cardStatus as CardStatus,
    cardExpiresAt: e.cardExpiresAt ? e.cardExpiresAt.toISOString() : null,
    faceEnrolled: !!e.faceEmbedding,
    faceConsent: !!e.faceConsentAt,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toEmployeeDetail(
  e: EmployeeRow & { cardTokenHash: string | null; pinHash: string | null },
  scanCount: number,
  lastScanAt: Date | null
): EmployeeDetail {
  return {
    ...toEmployeeDTO(e),
    cardTokenHash: e.cardTokenHash,
    hasPin: !!e.pinHash,
    scanCount,
    lastScanAt: lastScanAt ? lastScanAt.toISOString() : null,
  };
}

type ScanRow = {
  id: number;
  kioskId: string;
  employeeId: string | null;
  tokenHash: string | null;
  faceMatchScore: number | null;
  faceMatchStatus: string;
  spoofFlags: string | null;
  decision: string;
  snapshotPath: string | null;
  latencyMs: number | null;
  offline: boolean;
  createdAt: Date;
  employee?: { fullName: string; employeeCode: string } | null;
};

export function toScanEventDTO(s: ScanRow): ScanEventDTO {
  let spoof: Record<string, unknown> | null = null;
  if (s.spoofFlags) {
    try {
      spoof = JSON.parse(s.spoofFlags) as Record<string, unknown>;
    } catch {
      spoof = null;
    }
  }
  return {
    id: s.id,
    kioskId: s.kioskId,
    employeeId: s.employeeId,
    employeeName: s.employee?.fullName ?? null,
    employeeCode: s.employee?.employeeCode ?? null,
    tokenHash: s.tokenHash,
    faceMatchScore: s.faceMatchScore,
    faceMatchStatus: (s.faceMatchStatus as FaceMatchStatus) ?? null,
    spoofFlags: spoof,
    decision: s.decision as Decision,
    snapshotPath: s.snapshotPath,
    latencyMs: s.latencyMs,
    offline: s.offline,
    createdAt: s.createdAt.toISOString(),
  };
}

type KioskRow = {
  id: string;
  kioskId: string;
  name: string;
  location: string | null;
  status: string;
  thresholdGranted: number;
  thresholdChallenge: number;
  challengeMode: string;
  crlVersion: number;
  lastSyncAt: Date | null;
  configVersion: number;
};

export function toKioskDTO(k: KioskRow): KioskDTO {
  return {
    id: k.id,
    kioskId: k.kioskId,
    name: k.name,
    location: k.location,
    status: k.status as KioskStatus,
    thresholdGranted: k.thresholdGranted,
    thresholdChallenge: k.thresholdChallenge,
    challengeMode: k.challengeMode,
    crlVersion: k.crlVersion,
    lastSyncAt: k.lastSyncAt ? k.lastSyncAt.toISOString() : null,
    configVersion: k.configVersion,
  };
}

type AdminRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
};

export function toAdminUserDTO(a: AdminRow): AdminUserDTO {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role as AdminUserDTO["role"],
    createdAt: a.createdAt.toISOString(),
  };
}
