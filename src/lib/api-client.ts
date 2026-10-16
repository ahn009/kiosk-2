import type { AdminUserDTO } from "@/lib/types";

const API_PREFIX = "/api/v1";

let tokenGetter: (() => string | null) | null = null;
let logoutHandler: (() => void) | null = null;

export function configureApiClient(opts: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}) {
  tokenGetter = opts.getToken;
  logoutHandler = opts.onUnauthorized;
}

export interface ApiError {
  error: string;
  status: number;
}

export async function api<T = unknown>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
    headers?: Record<string, string>;
    raw?: boolean;
    skipAuth?: boolean;
  } = {}
): Promise<T> {
  const token = tokenGetter?.();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    ...(!opts.skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 401) {
    logoutHandler?.();
  }

  if (opts.raw) {
    return res as unknown as T;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw {
      error: (data && (data.error || data.message)) || res.statusText,
      status: res.status,
    } as ApiError;
  }
  return data as T;
}

// ---- Typed helpers ----
export const apiClient = {
  auth: {
    login: (email: string, password: string) =>
      api<{ token: string; admin: AdminUserDTO }>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    logout: () => api("/auth/logout", { method: "POST" }),
  },
  dashboard: {
    stats: () => api<import("@/lib/types").DashboardStats>("/dashboard/stats"),
  },
  employees: {
    list: (params: {
      page?: number;
      q?: string;
      department_id?: string;
      status?: string;
    } = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.q) q.set("q", params.q);
      if (params.department_id) q.set("department_id", params.department_id);
      if (params.status) q.set("status", params.status);
      return api<{
        items: import("@/lib/types").EmployeeDTO[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/employees?${q.toString()}`);
    },
    get: (id: string) =>
      api<import("@/lib/types").EmployeeDetail>(`/employees/${id}`),
    create: (body: Record<string, unknown>) =>
      api<{ employee: import("@/lib/types").EmployeeDetail; cardToken: string }>(
        "/employees",
        { method: "POST", body }
      ),
    update: (id: string, body: Record<string, unknown>) =>
      api<import("@/lib/types").EmployeeDetail>(`/employees/${id}`, {
        method: "PATCH",
        body,
      }),
    remove: (id: string) =>
      api(`/employees/${id}`, { method: "DELETE" }),
    reissueCard: (id: string) =>
      api<{ cardToken: string; employee: import("@/lib/types").EmployeeDetail }>(
        `/employees/${id}/reissue-card`,
        { method: "POST" }
      ),
    revoke: (id: string, body: { reason?: string; suspendFace?: boolean }) =>
      api(`/employees/${id}/revoke`, { method: "POST", body }),
    scanHistory: (id: string, page = 1) =>
      api<{
        items: import("@/lib/types").ScanEventDTO[];
        total: number;
        page: number;
      }>(`/employees/${id}/scan-history?page=${page}`),
    stats: (id: string) =>
      api<{
        totalScans: number;
        granted: number;
        denied: number;
        grantRate: number;
        avgLatencyMs: number;
        avgMatchScore: number;
        offlineCount: number;
        daily: { date: string; granted: number; denied: number }[];
        byKiosk: { kioskId: string; granted: number; denied: number }[];
        scoreDistribution: { bin: string; count: number }[];
        recent: {
          id: number;
          kioskId: string;
          decision: string;
          faceMatchStatus: string | null;
          faceMatchScore: number | null;
          latencyMs: number | null;
          offline: boolean;
          createdAt: string;
        }[];
      }>(`/employees/${id}/stats`),
    importCsv: (rows: {
      employeeCode: string;
      fullName: string;
      departmentCode?: string;
      designation?: string;
      accessLevel?: number;
    }[]) =>
      api<{
        successCount: number;
        errorCount: number;
        errors: { row: number; message: string }[];
        created: {
          id: string;
          employeeCode: string;
          fullName: string;
          cardToken: string;
        }[];
        skipped: { row: number; employeeCode: string; reason: string }[];
      }>("/employees/import", { method: "POST", body: { rows } }),
  },
  enrollment: {
    capture: (
      employeeId: string,
      body: { images: string[]; consentAcknowledged: boolean }
    ) =>
      api(`/enrollment/${employeeId}/capture`, { method: "POST", body }),
    status: (employeeId: string) =>
      api<{
        status: string;
        qualityScore?: number;
        consentAcknowledged: boolean;
        enrolledAt?: string;
      }>(`/enrollment/${employeeId}/status`),
  },
  audit: {
    scans: (params: {
      kiosk_id?: string;
      employee_id?: string;
      decision?: string;
      from?: string;
      to?: string;
      page?: number;
    } = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, String(v));
      });
      return api<{
        items: import("@/lib/types").ScanEventDTO[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/audit/scans?${q.toString()}`);
    },
  },
  kiosks: {
    list: () => api<import("@/lib/types").KioskDTO[]>("/kiosks"),
    update: (id: string, body: Record<string, unknown>) =>
      api<import("@/lib/types").KioskDTO>(`/kiosks/${id}`, {
        method: "PATCH",
        body,
      }),
    heartbeat: () =>
      api<{ ok: boolean; updated: number; timestamp: string }>(
        "/kiosks/heartbeat",
        { method: "POST" }
      ),
    simulate: () =>
      api<{
        ok: boolean;
        kioskId: string;
        name: string;
        previousStatus: string;
        newStatus: string;
        changed: boolean;
        title: string;
        message: string;
        severity: string;
      }>("/kiosks/simulate", { method: "POST" }),
    simulateScan: (kioskId?: string, decision?: string) =>
      api<{
        ok: boolean;
        scanId: number;
        kioskId: string;
        employee: { code: string; name: string };
        decision: string;
        faceMatchStatus: string;
        matchScore: number;
        latencyMs: number;
        snapshotPath: string;
      }>(
        `/kiosk/simulate-scan?${new URLSearchParams({
          ...(kioskId ? { kioskId } : {}),
          ...(decision ? { decision } : {}),
        }).toString()}`,
        { method: "POST" }
      ),
    stats: (id: string) =>
      api<{
        kioskId: string;
        name: string;
        location: string | null;
        status: string;
        thresholds: { granted: number; challenge: number };
        challengeMode: string;
        crlVersion: number;
        lastSyncAt: string | null;
        totalScans: number;
        granted: number;
        denied: number;
        grantRate: number;
        avgLatencyMs: number;
        p95LatencyMs: number;
        avgMatchScore: number;
        offlineCount: number;
        daily: { date: string; granted: number; denied: number }[];
        scoreDistribution: { bin: string; count: number }[];
        topEmployees: {
          id: string;
          employeeCode: string;
          fullName: string;
          photoUrl: string | null;
          scanCount: number;
        }[];
        recent: {
          id: number;
          decision: string;
          faceMatchStatus: string | null;
          faceMatchScore: number | null;
          latencyMs: number | null;
          offline: boolean;
          createdAt: string;
        }[];
      }>(`/kiosks/${id}/stats`),
    config: (kioskId: string) =>
      api<{
        kioskId: string;
        thresholdGranted: number;
        thresholdChallenge: number;
        challengeMode: string;
        crlVersion: number;
        lockdown: boolean;
      }>(`/kiosk/config/${kioskId}`),
    verifyToken: (body: {
      token: string;
      kioskId: string;
      ts: number;
      nonce: string;
    }) =>
      api<import("@/lib/types").VerifyTokenResponse>("/kiosk/verify-token", {
        method: "POST",
        body,
      }),
    verifyFace: (body: import("@/lib/types").VerifyFaceRequest) =>
      api<import("@/lib/types").VerifyFaceResponse>("/kiosk/verify-face", {
        method: "POST",
        body,
      }),
    sync: (body: {
      kioskId: string;
      events: unknown[];
      crlVersion: number;
    }) => api("/kiosk/sync", { method: "POST", body }),
  },
  departments: {
    list: () =>
      api<{ id: string; name: string; code: string }[]>("/departments"),
  },
  admin: {
    lockdown: (reason: string) =>
      api("/admin/lockdown", { method: "POST", body: { reason } }),
    clearLockdown: () => api("/admin/lockdown", { method: "DELETE" }),
    users: () => api<import("@/lib/types").AdminUserDTO[]>("/admin/users"),
    actions: (page = 1) =>
      api<{
        items: {
          id: string;
          actorId: string | null;
          actorName: string | null;
          target: string;
          action: string;
          beforeData: string | null;
          afterData: string | null;
          createdAt: string;
        }[];
        total: number;
        page: number;
      }>(`/admin-actions?page=${page}`),
  },
  revocations: {
    list: () =>
      api<
        {
          tokenHash: string;
          reason: string | null;
          revokedAt: string;
          employeeName: string | null;
          employeeCode: string | null;
        }[]
      >("/revocations"),
  },
  webhooks: {
    get: () =>
      api<{
        targets: {
          id: string;
          name: string;
          url: string;
          type: string;
          enabled: boolean;
          /** Secrets are never returned; this flags whether one is stored. */
          hasSecret: boolean;
          events: string[];
          createdAt: string;
        }[];
        globalEnabled: boolean;
        lastDispatchAt: string | null;
        dispatchCount: number;
        failureCount: number;
      }>("/webhooks/config"),
    save: (target: {
      id?: string;
      name: string;
      url: string;
      type: string;
      enabled: boolean;
      /** New secret (plaintext, encrypted server-side). Omit to keep existing. */
      secret?: string;
      events: string[];
    }) => api("/webhooks/config", { method: "POST", body: target }),
    remove: (id: string) =>
      api(`/webhooks/config?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    setGlobal: (globalEnabled: boolean) =>
      api("/webhooks/config", { method: "PATCH", body: { globalEnabled } }),
    test: (body?: {
      type?: string;
      title?: string;
      message?: string;
      severity?: string;
    }) =>
      api<{
        results: {
          ok: boolean;
          name: string;
          status?: number;
          error?: string;
        }[];
      }>("/webhooks/test", { method: "POST", body: body ?? {} }),
    exportAlerts: (params: {
      from?: string;
      to?: string;
      decision?: string;
      kiosk_id?: string;
      limit?: number;
    } = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, String(v));
      });
      return api<{
        exported_at: string;
        count: number;
        events: Record<string, unknown>[];
      }>(`/webhooks/alerts/export?${q.toString()}`);
    },
    exportCsvUrl: (params: {
      from?: string;
      to?: string;
      decision?: string;
      kiosk_id?: string;
      limit?: number;
    } = {}) => {
      const q = new URLSearchParams({ format: "csv" });
      Object.entries(params).forEach(([k, v]) => {
        if (v) q.set(k, String(v));
      });
      return `${API_PREFIX}/webhooks/alerts/export?${q.toString()}`;
    },
  },
  mobile: {
    login: (employeeCode: string) =>
      api<{
        token: string;
        employee: {
          id: string;
          employeeCode: string;
          fullName: string;
          designation: string | null;
          departmentName: string | null;
          accessLevel: number;
          photoUrl: string | null;
          cardStatus: string;
          cardExpiresAt: string | null;
          faceEnrolled: boolean;
        };
      }>("/mobile/login", { method: "POST", body: { employeeCode } }),
    me: (mobileToken: string) =>
      api<{
        employee: {
          id: string;
          employeeCode: string;
          fullName: string;
          designation: string | null;
          departmentName: string | null;
          accessLevel: number;
          photoUrl: string | null;
          cardStatus: string;
          cardExpiresAt: string | null;
          faceEnrolled: boolean;
        };
        todayScans: number;
        lastEntry: { at: string; kioskId: string } | null;
        alerts: {
          id: number;
          at: string;
          kioskId: string;
          decision: string;
          faceMatchStatus: string | null;
          faceMatchScore: number | null;
        }[];
      }>("/mobile/me", { skipAuth: true, headers: { Authorization: `Bearer ${mobileToken}` } }),
    scans: (mobileToken: string, page = 1) =>
      api<{
        items: {
          id: number;
          kioskId: string;
          decision: string;
          faceMatchStatus: string | null;
          faceMatchScore: number | null;
          latencyMs: number | null;
          offline: boolean;
          createdAt: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/mobile/scans?page=${page}`, { skipAuth: true, headers: { Authorization: `Bearer ${mobileToken}` } }),
    reportLost: (mobileToken: string, reason?: string) =>
      api<{ ok: boolean; cardStatus: string; message: string }>(
        "/mobile/report-lost",
        { method: "POST", body: { reason }, skipAuth: true, headers: { Authorization: `Bearer ${mobileToken}` } }
      ),
  },
};
