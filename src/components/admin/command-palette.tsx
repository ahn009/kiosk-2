"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  ScanFace,
  FileSearch,
  Cpu,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Sun,
  Moon,
  Lock,
  Unlock,
  Zap,
  Activity,
  Bell,
  PlayCircle,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

interface CommandAction {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  keywords: string[];
  shortcut?: string;
  run: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const setSection = useAppStore((s) => s.setAdminSection);
  const setMode = useAppStore((s) => s.setMode);
  const logout = useAppStore((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  // Simulate scan mutation
  const simulateScan = useMutation({
    mutationFn: (decision?: string) => apiClient.kiosks.simulateScan(undefined, decision),
    onSuccess: (data) => {
      toast[data.decision === "granted" ? "success" : "warning"](
        `Scan simulated: ${data.decision}`,
        {
          description: `${data.employee.name} (${data.employee.code}) · ${data.kioskId} · score ${(data.matchScore * 100).toFixed(0)}%`,
        }
      );
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["audit-scans"] });
      qc.invalidateQueries({ queryKey: ["employee-stats"] });
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Simulation failed"),
  });

  // Lockdown drill mutation
  const lockdownDrill = useMutation({
    mutationFn: () => apiClient.admin.lockdown("Lockdown drill triggered via command palette"),
    onSuccess: () => {
      toast.error("Lockdown drill engaged — all kiosks set to lockdown");
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["kiosks"] });
      qc.invalidateQueries({ queryKey: ["public-status"] });
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Drill failed"),
  });

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navActions: CommandAction[] = [
    {
      id: "nav-dashboard",
      label: "Dashboard",
      group: "Navigate",
      icon: LayoutDashboard,
      keywords: ["home", "overview", "stats"],
      run: () => setSection("dashboard"),
    },
    {
      id: "nav-employees",
      label: "Employees",
      group: "Navigate",
      icon: Users,
      keywords: ["staff", "card", "access"],
      run: () => setSection("employees"),
    },
    {
      id: "nav-enrollment",
      label: "Enrollment",
      group: "Navigate",
      icon: ScanFace,
      keywords: ["face", "biometric", "capture"],
      run: () => setSection("enrollment"),
    },
    {
      id: "nav-audit",
      label: "Audit Trail",
      group: "Navigate",
      icon: FileSearch,
      keywords: ["scan", "log", "history", "events"],
      run: () => setSection("audit"),
    },
    {
      id: "nav-kiosks",
      label: "Kiosks",
      group: "Navigate",
      icon: Cpu,
      keywords: ["device", "status", "threshold"],
      run: () => setSection("kiosks"),
    },
    {
      id: "nav-calibration",
      label: "Calibration",
      group: "Navigate",
      icon: Gauge,
      keywords: ["roc", "far", "frr", "threshold", "tune"],
      run: () => setSection("calibration"),
    },
    {
      id: "nav-security",
      label: "Security Center",
      group: "Navigate",
      icon: ShieldAlert,
      keywords: ["lockdown", "crl", "revocation", "webhook"],
      run: () => setSection("security"),
    },
  ];

  const quickActions: CommandAction[] = [
    {
      id: "act-lockdown",
      label: "Go to Lockdown control",
      group: "Actions",
      icon: Lock,
      keywords: ["emergency", "lockdown", "lock"],
      run: () => setSection("security"),
    },
    {
      id: "act-theme",
      label: "Toggle dark / light theme",
      group: "Actions",
      icon: theme === "dark" ? Sun : Moon,
      keywords: ["theme", "dark", "light", "mode"],
      run: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    {
      id: "act-launcher",
      label: "Back to Launcher",
      group: "Actions",
      icon: ArrowLeft,
      keywords: ["exit", "home", "launcher"],
      run: () => setMode("launcher"),
    },
    {
      id: "act-logout",
      label: "Sign out",
      group: "Actions",
      icon: ShieldCheck,
      keywords: ["logout", "sign out", "exit"],
      run: () => logout(),
    },
  ];

  const simulateActions: CommandAction[] = [
    {
      id: "sim-scan",
      label: "Simulate scan (random employee)",
      group: "Simulate",
      icon: PlayCircle,
      keywords: ["scan", "test", "demo", "fake", "simulate", "random"],
      run: () => simulateScan.mutate(undefined),
    },
    {
      id: "sim-scan-granted",
      label: "Simulate granted scan",
      group: "Simulate",
      icon: PlayCircle,
      keywords: ["scan", "granted", "success", "allow", "test"],
      run: () => simulateScan.mutate("granted"),
    },
    {
      id: "sim-scan-denied",
      label: "Simulate denied scan",
      group: "Simulate",
      icon: PlayCircle,
      keywords: ["scan", "denied", "fail", "reject", "test", "spoof"],
      run: () => simulateScan.mutate("denied"),
    },
    {
      id: "sim-lockdown",
      label: "Trigger lockdown drill",
      group: "Simulate",
      icon: AlertTriangle,
      keywords: ["lockdown", "drill", "emergency", "test", "trigger"],
      run: () => {
        if (confirm("Trigger a lockdown drill? All kiosks will be set to lockdown mode. You can clear it from the Security Center.")) {
          lockdownDrill.mutate();
        }
      },
    },
  ];

  const allActions = [...navActions, ...quickActions, ...simulateActions];

  function runAction(action: CommandAction) {
    action.run();
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search sections…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {navActions.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.label} ${a.keywords.join(" ")}`}
              onSelect={() => runAction(a)}
              className="gap-2"
            >
              <a.icon className="size-4 text-muted-foreground" />
              <span>{a.label}</span>
              {a.shortcut && (
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                  {a.shortcut}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {quickActions.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.label} ${a.keywords.join(" ")}`}
              onSelect={() => runAction(a)}
              className="gap-2"
            >
              <a.icon className="size-4 text-muted-foreground" />
              <span>{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Simulate">
          {simulateActions.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.label} ${a.keywords.join(" ")}`}
              onSelect={() => runAction(a)}
              className="gap-2"
            >
              <a.icon className="size-4 text-muted-foreground" />
              <span>{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tips">
          <CommandItem disabled className="gap-2 opacity-70">
            <Zap className="size-4 text-primary" />
            <span className="text-xs">Press </span>
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">⌘K</kbd>
            <span className="text-xs">anywhere to open this palette</span>
          </CommandItem>
          <CommandItem disabled className="gap-2 opacity-70">
            <Activity className="size-4 text-primary" />
            <span className="text-xs">Real-time alerts stream to the bell</span>
            <Bell className="size-3 text-muted-foreground ml-auto" />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
