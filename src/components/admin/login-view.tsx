"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Lock,
  Fingerprint,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import type { AdminRole } from "@/lib/types";

interface QuickAccount {
  email: string;
  password: string;
  role: AdminRole;
  label: string;
  accent: string;
}

const QUICK_ACCOUNTS: QuickAccount[] = [
  {
    email: "admin@acme.io",
    password: "Admin@2024",
    role: "superadmin",
    label: "Super Admin",
    accent: "bg-primary/10 text-primary border-primary/30",
  },
  {
    email: "security@acme.io",
    password: "Secure@2024",
    role: "security_officer",
    label: "Security",
    accent: "bg-destructive/10 text-destructive border-destructive/30",
  },
  {
    email: "hr@acme.io",
    password: "Hradmin@2024",
    role: "hr_admin",
    label: "HR Admin",
    accent: "bg-warning/10 text-warning-foreground border-warning/40",
  },
  {
    email: "viewer@acme.io",
    password: "View@2024",
    role: "viewer",
    label: "Viewer",
    accent: "bg-muted text-muted-foreground border-border",
  },
];

export function LoginView() {
  const setMode = useAppStore((s) => s.setMode);
  const login = useAppStore((s) => s.login);
  const setAdminSection = useAppStore((s) => s.setAdminSection);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.auth.login(email, password);
      login(res.token, res.admin);
      toast.success(`Welcome back, ${res.admin.name ?? res.admin.email}`);
      setAdminSection("dashboard");
    } catch (err) {
      const e = err as { error?: string };
      toast.error(e?.error ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function fill(acc: QuickAccount) {
    setEmail(acc.email);
    setPassword(acc.password);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background bg-grid relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/50 to-background pointer-events-none" />
      <header className="relative z-10 px-4 sm:px-6 py-5 flex items-center justify-between">
        <button
          onClick={() => setMode("launcher")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Launcher
        </button>
        <Badge variant="outline" className="gap-1.5">
          <Lock className="size-3" />
          Encrypted session
        </Badge>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex flex-col items-center text-center gap-3 pt-2">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center shadow-lg shadow-primary/20">
                  <ShieldCheck className="size-7 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl">Admin Dashboard</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign in to manage SentinelKiosk access control
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@acme.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <Fingerprint className="size-4" />
                      Sign in
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      Quick fill · seeded accounts
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {QUICK_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fill(acc)}
                      className="text-left p-2.5 rounded-lg border border-border bg-background hover:bg-accent/50 hover:border-border/70 transition-all"
                    >
                      <div className="text-xs font-semibold truncate">
                        {acc.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {acc.email}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground text-center">
                  Click a role to autofill credentials. Sessions expire in 30 minutes.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            SentinelKiosk v2.0 · All access events are logged immutably
          </p>
        </motion.div>
      </main>
    </div>
  );
}
