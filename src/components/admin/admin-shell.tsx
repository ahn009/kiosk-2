"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  ScanFace,
  FileSearch,
  Cpu,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Lock,
  Search as SearchIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAppStore, type AdminSection } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import type { AdminRole } from "@/lib/types";
import { roleBadgeClass, roleLabel, initials } from "./lib/admin-utils";
import { DashboardView } from "./views/dashboard-view";
import { EmployeesView } from "./views/employees-view";
import { EnrollmentView } from "./views/enrollment-view";
import { AuditView } from "./views/audit-view";
import { KiosksView } from "./views/kiosks-view";
import { CalibrationView } from "./views/calibration-view";
import { SecurityView } from "./views/security-view";
import { LiveAlertBell } from "./live-alert-bell";
import { CommandPalette } from "./command-palette";

interface NavItem {
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AdminRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["superadmin", "security_officer", "hr_admin", "viewer"] },
  { id: "employees", label: "Employees", icon: Users, roles: ["superadmin", "security_officer", "hr_admin", "viewer"] },
  { id: "enrollment", label: "Enrollment", icon: ScanFace, roles: ["superadmin", "hr_admin"] },
  { id: "audit", label: "Audit Trail", icon: FileSearch, roles: ["superadmin", "security_officer", "viewer"] },
  { id: "kiosks", label: "Kiosks", icon: Cpu, roles: ["superadmin", "security_officer"] },
  { id: "calibration", label: "Calibration", icon: Gauge, roles: ["superadmin", "security_officer"] },
  { id: "security", label: "Security", icon: ShieldAlert, roles: ["superadmin", "security_officer"] },
];

const SECTION_TITLES: Record<AdminSection, string> = {
  dashboard: "Operations Dashboard",
  employees: "Employee Management",
  enrollment: "Face Enrollment Wizard",
  audit: "Audit Trail",
  kiosks: "Kiosk Fleet",
  calibration: "Threshold Calibration",
  security: "Security Center",
};

function NavList({
  items,
  activeSection,
  onNavigate,
}: {
  items: NavItem[];
  activeSection: AdminSection;
  onNavigate?: (s: AdminSection) => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon
              className={cn(
                "size-4 transition-transform",
                isActive ? "scale-110" : "group-hover:scale-105",
              )}
            />
            {item.label}
            {isActive && (
              <motion.span
                layoutId="nav-active"
                className="ml-auto size-1.5 rounded-full bg-primary"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function AdminShell() {
  const admin = useAppStore((s) => s.admin);
  const section = useAppStore((s) => s.adminSection);
  const setSection = useAppStore((s) => s.setAdminSection);
  const enrollmentTargetId = useAppStore((s) => s.enrollmentTargetId);
  const setMode = useAppStore((s) => s.setMode);
  const logout = useAppStore((s) => s.logout);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { theme, setTheme } = useTheme();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-shell"],
    queryFn: () => apiClient.dashboard.stats(),
    refetchInterval: 30_000,
  });

  if (!admin) return null;

  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(admin.role));
  // Force enrollment view when targetId is set
  const activeSection: AdminSection =
    enrollmentTargetId ? "enrollment" : section;

  function handleLogout() {
    apiClient.auth.logout().catch(() => {});
    logout();
    toast.success("Signed out");
  }

  function selectSection(s: AdminSection) {
    setSection(s);
    if (s !== "enrollment") {
      useAppStore.getState().setEnrollmentTargetId(null);
    }
    setMobileNavOpen(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CommandPalette />
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center h-14 px-3 sm:px-4 gap-2 border-b border-border bg-card/80 backdrop-blur-md">
        {/* Mobile nav trigger */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="px-4 py-4 border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center">
                  <ShieldCheck className="size-4 text-primary-foreground" />
                </div>
                SentinelKiosk
              </SheetTitle>
            </SheetHeader>
            <div className="p-3">
              <NavList
                items={visibleNav}
                activeSection={activeSection}
                onNavigate={(s) => selectSection(s)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Brand + section title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden lg:flex size-9 rounded-xl bg-gradient-to-br from-primary to-teal-700 items-center justify-center shadow-md shadow-primary/20 shrink-0">
            <ShieldCheck className="size-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {SECTION_TITLES[activeSection]}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">
              SentinelKiosk · ACME
            </p>
          </div>
        </div>

        {/* Lockdown indicator */}
        {stats?.lockdownActive && (
          <Badge
            variant="destructive"
            className="hidden sm:inline-flex ml-2 animate-pulse"
          >
            <Lock className="size-3" />
            LOCKDOWN
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Command palette trigger */}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 text-xs text-muted-foreground transition-colors"
            aria-label="Open command palette"
          >
            <SearchIcon className="size-3.5" />
            <span>Search…</span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">⌘K</kbd>
          </button>

          {/* Live alerts bell */}
          <LiveAlertBell />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="size-4 hidden dark:block" />
            <Moon className="size-4 block dark:hidden" />
          </Button>

          {/* Back to launcher */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("launcher")}
            className="hidden md:inline-flex"
          >
            <ArrowLeft className="size-4" />
            Launcher
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1.5 pr-2.5 py-1 hover:bg-accent transition-colors">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs">
                    {initials(admin.name ?? admin.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start leading-tight">
                  <span className="text-xs font-medium">{admin.name ?? admin.email}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {roleLabel[admin.role]}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="font-medium">{admin.name ?? "Admin"}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {admin.email}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center self-start rounded-md border px-1.5 py-0.5 text-[10px] font-medium mt-0.5",
                    roleBadgeClass[admin.role],
                  )}
                >
                  {roleLabel[admin.role]}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setMode("launcher")}
                className="cursor-pointer"
              >
                <ArrowLeft className="size-4" />
                Back to Launcher
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-sidebar/50 flex-col">
          <div className="p-4 flex-1 overflow-y-auto scrollbar-thin">
            <p className="px-3 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Navigation
            </p>
            <NavList
              items={visibleNav}
              activeSection={activeSection}
              onNavigate={(s) => selectSection(s)}
            />
            <div className="mt-6 p-3 rounded-lg border border-border bg-card/50">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                System Status
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lockdown</span>
                  {stats?.lockdownActive ? (
                    <Badge variant="destructive" className="text-[10px] py-0">ACTIVE</Badge>
                  ) : (
                    <span className="text-success font-medium">Clear</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Kiosks</span>
                  <span className="font-medium">
                    {stats?.activeKiosks ?? "—"} / {stats?.totalKiosks ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Enrolled</span>
                  <span className="font-medium">
                    {stats?.enrolledEmployees ?? "—"} / {stats?.totalEmployees ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {activeSection === "dashboard" && <DashboardView />}
                {activeSection === "employees" && <EmployeesView />}
                {activeSection === "enrollment" && <EnrollmentView />}
                {activeSection === "audit" && <AuditView />}
                {activeSection === "kiosks" && <KiosksView />}
                {activeSection === "calibration" && <CalibrationView />}
                {activeSection === "security" && <SecurityView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card/40">
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-primary" />
            <span>All scans logged immutably · AES-256 · HMAC-SHA256</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              API online
            </span>
            <span>v2.0 · build {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Floating mobile menu close button when sheet open */}
      {mobileNavOpen && (
        <button
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="hidden"
        >
          <X />
        </button>
      )}
    </div>
  );
}
