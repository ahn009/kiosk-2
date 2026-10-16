// Shared API & domain types

export type CardStatus = "active" | "revoked" | "expired" | "lost";
export type AdminRole = "superadmin" | "security_officer" | "hr_admin" | "viewer";
export type Decision =
  | "granted"
  | "denied"
  | "challenge_failed"
  | "error"
  | "lockdown"
  | "supervisor_override";
export type FaceMatchStatus = "match" | "mismatch" | "no_face" | "liveness_fail";
export type KioskStatus = "online" | "offline" | "maintenance" | "lockdown";

export interface EmployeeDTO {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  designation: string | null;
  accessLevel: number;
  photoUrl: string | null;
  cardStatus: CardStatus;
  cardExpiresAt: string | null;
  faceEnrolled: boolean;
  faceConsent: boolean;
  createdAt: string;
}

export interface EmployeeDetail extends EmployeeDTO {
  cardTokenHash: string | null;
  hasPin: boolean;
  scanCount: number;
  lastScanAt: string | null;
}

export interface ScanEventDTO {
  id: number;
  kioskId: string;
  employeeId: string | null;
  employeeName: string | null;
  employeeCode: string | null;
  tokenHash: string | null;
  faceMatchScore: number | null;
  faceMatchStatus: FaceMatchStatus | null;
  spoofFlags: Record<string, unknown> | null;
  decision: Decision;
  snapshotPath: string | null;
  latencyMs: number | null;
  offline: boolean;
  createdAt: string;
}

export interface KioskDTO {
  id: string;
  kioskId: string;
  name: string;
  location: string | null;
  status: KioskStatus;
  thresholdGranted: number;
  thresholdChallenge: number;
  challengeMode: string;
  crlVersion: number;
  lastSyncAt: string | null;
  configVersion: number;
}

export interface DashboardStats {
  scansToday: number;
  grantedToday: number;
  deniedToday: number;
  grantRate: number;
  activeKiosks: number;
  totalKiosks: number;
  totalEmployees: number;
  enrolledEmployees: number;
  lockdownActive: boolean;
  spoofAttemptsToday: number;
  scansByHour: { hour: number; count: number }[];
  scansByKiosk: { kioskId: string; name: string; count: number; denied: number }[];
  recentDenials: ScanEventDTO[];
  frr: number;
  far: number | null; // null = not measurable without ground-truth labels
}

export interface VerifyTokenResponse {
  status: "await_face" | "denied";
  reason?: "invalid_token" | "revoked" | "expired" | "lockdown" | "no_face_enrolled";
  scanId?: string;
  employeeRef?: { code: string; name: string; accessLevel: number; photoUrl: string | null };
  challengeSeed?: "blink" | "turn_left" | "turn_right";
}

export interface VerifyFaceRequest {
  scanId: string;
  embedding: number[];
  livenessScore: number;
  spoofFlags: Record<string, unknown>;
  snapshot?: string;
}

export interface VerifyFaceResponse {
  decision: Decision;
  matchScore: number;
  faceMatchStatus: FaceMatchStatus;
  employeeDisplay?: {
    code: string;
    name: string;
    department: string | null;
    designation: string | null;
    accessLevel: number;
    photoUrl: string | null;
    lastEntry: string | null;
  };
}

export interface AdminUserDTO {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  admin: AdminUserDTO;
}
