"use client";

import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  ScanFace,
  Fingerprint,
  Lock,
  Activity,
  Building2,
  Cpu,
  ArrowRight,
  Server,
  Camera,
  Database,
  Zap,
  Smartphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Launcher() {
  const setMode = useAppStore((s) => s.setMode);
  const setKioskId = useAppStore((s) => s.setKioskId);

  const { data: kiosks } = useQuery({
    queryKey: ["public-kiosks"],
    queryFn: () => api("/public/kiosks") as Promise<{ kioskId: string; name: string; location: string | null; status: string }[]>,
  });

  const { data: status } = useQuery({
    queryKey: ["public-status"],
    queryFn: () =>
      api("/public/status") as Promise<{
        lockdownActive: boolean;
        orgCode: string;
        orgName: string;
      }>,
  });

  const enterAdmin = () => {
    setMode("admin");
    setKioskId(null);
  };

  const enterKiosk = (id: string) => {
    setKioskId(id);
    setMode("kiosk");
  };

  const enterMobile = () => {
    setMode("mobile");
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/10 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute top-1/3 -right-32 size-80 rounded-full bg-teal-500/10 blur-3xl animate-pulse" style={{ animationDuration: "8s", animationDelay: "1s" }} />
        <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-emerald-400/10 blur-3xl animate-pulse" style={{ animationDuration: "7s", animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="relative border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center shadow-lg shadow-primary/20">
              <ShieldCheck className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight leading-none">
                SentinelKiosk
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Access Control System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex gap-1.5">
              <span className={`size-1.5 rounded-full ${status?.lockdownActive ? "bg-destructive" : "bg-success animate-pulse"}`} />
              {status?.lockdownActive ? "LOCKDOWN ACTIVE" : "System Secure"}
            </Badge>
            <Badge variant="secondary" className="hidden md:flex">
              v2.0 · {status?.orgCode ?? "ACME"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="relative flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
            <Fingerprint className="size-3.5 text-primary" />
            Encrypted QR · Face Recognition · Immutable Audit
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
            Choose your{" "}
            <span className="bg-gradient-to-r from-primary to-teal-600 bg-clip-text text-transparent">
              entry point
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg text-balance">
            Launch the admin dashboard to manage employees, enrollments, and
            security — or start a kiosk session to perform live ID verification
            and gate control.
          </p>
        </motion.section>

        {/* Three big cards */}
        <section className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {/* Admin */}
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onClick={enterAdmin}
            className="group text-left"
          >
            <Card className="relative overflow-hidden p-6 sm:p-7 h-full border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
              <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="size-6" />
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">Admin Dashboard</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Manage employees, issue/revoke access cards, enroll faces,
                  review the audit trail, and control kiosks.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "Live stats",
                    "Card issuance",
                    "Enrollment",
                    "Audit log",
                    "Lockdown",
                  ].map((t) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </motion.button>

          {/* Kiosk */}
          <motion.button
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            onClick={() => enterKiosk(kiosks?.[0]?.kioskId ?? "KSK-001")}
            className="group text-left"
          >
            <Card className="relative overflow-hidden p-6 sm:p-7 h-full border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer bg-gradient-to-br from-card to-teal-950/5">
              <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ScanFace className="size-6" />
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">Kiosk Mode</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Fullscreen verification flow: scan encrypted QR ID, liveness
                  check, face match, gate trigger, and immutable logging.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["QR scan", "Face match", "Liveness", "Gate relay"].map(
                    (t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </Card>
          </motion.button>

          {/* Mobile */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={enterMobile}
            className="group text-left md:col-span-2 lg:col-span-1"
          >
            <Card className="relative overflow-hidden p-6 sm:p-7 h-full border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer bg-gradient-to-br from-card to-emerald-950/5">
              <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smartphone className="size-6" />
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">Mobile Companion</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Employee self-service PWA — view your scan history, card
                  status, and report a lost card for instant revocation.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Self-service", "Scan history", "Lost card", "Alerts"].map(
                    (t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </Card>
          </motion.button>
        </section>

        {/* Kiosk selector */}
        {kiosks && kiosks.length > 0 && (
          <section className="mt-14 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Active Kiosks · click to launch
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {kiosks.map((k) => (
                <button
                  key={k.kioskId}
                  onClick={() => enterKiosk(k.kioskId)}
                  className="group"
                >
                  <Card className="p-4 h-full hover:border-primary/40 hover:shadow-md transition-all text-left cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {k.kioskId}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className={`size-1.5 rounded-full ${
                            k.status === "online"
                              ? "bg-success animate-pulse"
                              : k.status === "lockdown"
                                ? "bg-destructive"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <span className="text-muted-foreground capitalize">
                          {k.status}
                        </span>
                      </span>
                    </div>
                    <p className="font-semibold text-sm">{k.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {k.location}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Launch <ArrowRight className="size-3" />
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Feature strip */}
        <section className="mt-16 max-w-5xl mx-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                title: "< 2s P95",
                desc: "Scan-to-gate latency",
              },
              {
                icon: Lock,
                title: "AES-256",
                desc: "Encrypted snapshots",
              },
              {
                icon: Database,
                title: "Immutable",
                desc: "Append-only audit",
              },
              {
                icon: Activity,
                title: "72h offline",
                desc: "Edge fail-safe",
              },
            ].map((f) => (
              <Card key={f.title} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                    <f.icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/60 bg-card/30 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building2 className="size-3.5" />
            <span>SentinelKiosk · Edge Access Control Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Server className="size-3.5" /> Postgres + pgvector · Redis · MinIO
            </span>
            <span className="flex items-center gap-1.5">
              <Camera className="size-3.5" /> InsightFace ArcFace · MiniFASNet
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
