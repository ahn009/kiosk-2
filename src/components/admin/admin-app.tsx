"use client";

import { useAppStore } from "@/lib/store";
import { LoginView } from "./login-view";
import { AdminShell } from "./admin-shell";

export function AdminApp() {
  const admin = useAppStore((s) => s.admin);
  if (!admin) return <LoginView />;
  return <AdminShell />;
}
