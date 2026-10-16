"use client";

import { useAppStore } from "@/lib/store";
import { Launcher } from "@/components/launcher";
import dynamic from "next/dynamic";

// Load the two heavy apps dynamically so the launcher is fast & isolated.
const AdminApp = dynamic(
  () => import("@/components/admin/admin-app").then((m) => m.AdminApp),
  { ssr: false }
);
const KioskApp = dynamic(
  () => import("@/components/kiosk/kiosk-app").then((m) => m.KioskApp),
  { ssr: false }
);
const MobileApp = dynamic(
  () => import("@/components/mobile/mobile-app").then((m) => m.MobileApp),
  { ssr: false }
);

export default function Page() {
  const mode = useAppStore((s) => s.mode);

  if (mode === "admin") return <AdminApp />;
  if (mode === "kiosk") return <KioskApp />;
  if (mode === "mobile") return <MobileApp />;
  return <Launcher />;
}
