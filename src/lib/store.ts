"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUserDTO, AdminRole } from "@/lib/types";

export type AppMode = "launcher" | "admin" | "kiosk" | "mobile";

export type AdminSection =
  | "dashboard"
  | "employees"
  | "enrollment"
  | "audit"
  | "kiosks"
  | "calibration"
  | "security";

interface AppState {
  // top-level mode
  mode: AppMode;
  setMode: (m: AppMode) => void;

  // kiosk selection
  kioskId: string | null;
  setKioskId: (id: string | null) => void;

  // admin section
  adminSection: AdminSection;
  setAdminSection: (s: AdminSection) => void;

  // enrollment target (so enrollment wizard opens for a chosen employee)
  enrollmentTargetId: string | null;
  setEnrollmentTargetId: (id: string | null) => void;

  // mobile companion session (employee self-service)
  mobileToken: string | null;
  setMobileToken: (t: string | null) => void;

  // auth
  authToken: string | null;
  admin: AdminUserDTO | null;
  login: (token: string, admin: AdminUserDTO) => void;
  logout: () => void;
  hasRole: (...roles: AdminRole[]) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: "launcher",
      setMode: (mode) => set({ mode }),

      kioskId: null,
      setKioskId: (kioskId) => set({ kioskId }),

      adminSection: "dashboard",
      setAdminSection: (adminSection) => set({ adminSection }),

      enrollmentTargetId: null,
      setEnrollmentTargetId: (enrollmentTargetId) => set({ enrollmentTargetId }),

      mobileToken: null,
      setMobileToken: (mobileToken) => set({ mobileToken }),

      authToken: null,
      admin: null,
      login: (token, admin) => set({ authToken: token, admin }),
      logout: () =>
        set({
          authToken: null,
          admin: null,
          adminSection: "dashboard",
          mode: "launcher",
        }),
      hasRole: (...roles) => {
        const a = get().admin;
        return !!a && roles.includes(a.role);
      },
    }),
    {
      name: "kiosk-app-store",
      partialize: (s) => ({
        authToken: s.authToken,
        admin: s.admin,
        mode: s.mode,
        kioskId: s.kioskId,
        mobileToken: s.mobileToken,
      }),
    }
  )
);
