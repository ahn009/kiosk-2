"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Lock, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";

/**
 * Supervisor override — server-verified.
 *
 * A supervisor (security_officer or superadmin) authenticates with their own
 * admin credentials and states a reason. The server verifies the credentials,
 * checks the role, and records an immutable `supervisor_override` audit event
 * attributable to the supervisor. There is no client-side PIN and no fixed
 * credential: the browser can never grant this on its own.
 */
export function SupervisorOverride({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  employeeCode,
  kioskId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  employeeCode: string | null;
  kioskId: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setEmail("");
    setPassword("");
    setReason("");
    setError(null);
    setBusy(false);
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const submit = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Supervisor email and password are required.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("A reason (min 3 characters) is required.");
      return;
    }
    if (!employeeCode) {
      setError("No employee in context for this override.");
      return;
    }
    setBusy(true);
    try {
      await api<{ ok: boolean }>("/kiosk/supervisor-override", {
        method: "POST",
        skipAuth: true, // supervisor authenticates with their own credentials in the body
        body: {
          email: email.trim(),
          password,
          employeeCode,
          kioskId,
          reason: reason.trim(),
        },
      });
      onConfirm();
    } catch (e) {
      const err = e as { error?: string; status?: number };
      setError(
        err?.status === 429
          ? "Too many attempts — wait a minute and try again."
          : err?.error || "Override failed.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, email, password, reason, employeeCode, kioskId, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-amber-500/40 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="size-5" /> Supervisor Override
          </DialogTitle>
          <DialogDescription>
            A supervisor authenticates here to grant entry without a face
            match. This is recorded as{" "}
            <span className="font-mono">supervisor_override</span> in the audit
            log, attributed to the supervisor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="size-14 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center self-center">
            <Lock className="size-6" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sv-email">Supervisor email</Label>
            <Input
              id="sv-email"
              type="email"
              autoComplete="username"
              placeholder="supervisor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sv-password">Password</Label>
            <Input
              id="sv-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sv-reason">Reason for override</Label>
            <Textarea
              id="sv-reason"
              placeholder="e.g. Face match failed twice — verified ID badge visually"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              rows={2}
            />
          </div>

          {error && (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-amber-950"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Authorize override"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
