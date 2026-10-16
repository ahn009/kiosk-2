"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Printer,
  Sparkles,
  XCircle,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { asArray } from "../lib/admin-utils";

const SAMPLE_CSV = `employeeCode,fullName,departmentCode,designation,accessLevel
EMP-2001,Alice Johnson,ENG,Senior Engineer,3
EMP-2002,Marcus Lee,SEC,Security Officer,2
EMP-2003,Priya Patel,HR,HR Specialist,2`;

interface ParsedRow {
  rowIndex: number;
  employeeCode: string;
  fullName: string;
  departmentCode: string;
  designation: string;
  accessLevelRaw: string;
  accessLevel: number;
  departmentName?: string;
  error?: string;
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  created: { id: string; employeeCode: string; fullName: string; cardToken: string }[];
  skipped: { row: number; employeeCode: string; reason: string }[];
}

/** Minimal but quoted-aware CSV line parser. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((l) => parseCsvLine(l));
  return { headers, rows };
}

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load departments for code → name mapping in preview
  const { data: departmentsRaw } = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      asArray<{ id: string; name: string; code: string }>(
        await apiClient.departments.list(),
      ),
    enabled: open,
  });
  const departments = departmentsRaw ?? [];

  const deptByCode = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code: string }>();
    for (const d of departments) m.set(d.code.toUpperCase(), d);
    return m;
  }, [departments]);

  const parsed = useMemo(() => {
    if (!csvText.trim()) return { headers: [] as string[], rows: [] as ParsedRow[] };
    const { headers, rows } = parseCsv(csvText);
    const idx = {
      employeeCode: headers.indexOf("employeecode"),
      fullName: headers.indexOf("fullname"),
      departmentCode: headers.indexOf("departmentcode"),
      designation: headers.indexOf("designation"),
      accessLevel: headers.indexOf("accesslevel"),
    };
    const out: ParsedRow[] = [];
    const seenCodes = new Set<string>();
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const employeeCode = idx.employeeCode >= 0 ? (r[idx.employeeCode] ?? "") : "";
      const fullName = idx.fullName >= 0 ? (r[idx.fullName] ?? "") : "";
      const departmentCode = idx.departmentCode >= 0 ? (r[idx.departmentCode] ?? "") : "";
      const designation = idx.designation >= 0 ? (r[idx.designation] ?? "") : "";
      const accessLevelRaw = idx.accessLevel >= 0 ? (r[idx.accessLevel] ?? "") : "";

      let error: string | undefined;
      let accessLevel = 1;
      let departmentName: string | undefined;

      if (!employeeCode && !fullName) {
        error = "Empty row — missing employeeCode and fullName";
      } else if (!employeeCode) {
        error = "Missing employeeCode";
      } else if (!fullName) {
        error = "Missing fullName";
      } else {
        if (accessLevelRaw) {
          const n = Number(accessLevelRaw);
          if (!Number.isFinite(n) || n < 1 || n > 5 || !Number.isInteger(n)) {
            error = `Access level must be 1-5 (got "${accessLevelRaw}")`;
          } else {
            accessLevel = n;
          }
        }
        if (!error && departmentCode) {
          const d = deptByCode.get(departmentCode.toUpperCase());
          if (!d) {
            error = `Department code not found: "${departmentCode}"`;
          } else {
            departmentName = d.name;
          }
        }
        if (!error && seenCodes.has(employeeCode.toLowerCase())) {
          error = `Duplicate code in batch: "${employeeCode}"`;
        }
        if (!error) seenCodes.add(employeeCode.toLowerCase());
      }

      out.push({
        rowIndex: i + 1,
        employeeCode,
        fullName,
        departmentCode,
        designation,
        accessLevelRaw,
        accessLevel,
        departmentName,
        error,
      });
    }
    return { headers, rows: out };
  }, [csvText, deptByCode]);

  const validCount = parsed.rows.filter((r) => !r.error).length;
  const errorCount = parsed.rows.filter((r) => r.error).length;
  const totalCount = parsed.rows.length;

  const importMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      const payload = rows.map((r) => ({
        employeeCode: r.employeeCode,
        fullName: r.fullName,
        departmentCode: r.departmentCode || undefined,
        designation: r.designation || undefined,
        accessLevel: r.accessLevel,
      }));
      return apiClient.employees.importCsv(payload);
    },
    onSuccess: (res) => {
      setResult(res);
      setStep(3);
      toast.success(`Imported ${res.successCount} employees`);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: { error?: string }) => {
      toast.error(e?.error ?? "Import failed");
    },
  });

  function reset() {
    setStep(1);
    setCsvText("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onOpenChangeWrap(v: boolean) {
    if (!v) {
      // Give the close animation time, then reset
      setTimeout(reset, 200);
    }
    onOpenChange(v);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      toast.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsText(file);
  }

  async function printAll() {
    if (!result || result.created.length === 0) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    // QR codes are rendered LOCALLY — card tokens never leave the browser
    // for a third-party QR service.
    const { default: QRCode } = await import("qrcode");
    const cards = (
      await Promise.all(
        result.created.map(async (c) => {
          let qr = "";
          try {
            qr = await QRCode.toDataURL(c.cardToken, {
              width: 200,
              margin: 1,
              errorCorrectionLevel: "H",
            });
          } catch {
            qr = "";
          }
          return `
        <div class="card">
          ${qr ? `<img src="${qr}" alt="QR" />` : `<div class="noqr">QR unavailable</div>`}
          <div class="name">${escapeHtml(c.fullName)}</div>
          <div class="code">${escapeHtml(c.employeeCode)}</div>
        </div>`;
        }),
      )
    ).join("");
    w.document.write(`<!DOCTYPE html>
<html><head><title>Employee Card Tokens — Bulk Print</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; background: white;
          display: flex; flex-direction: column; align-items: center; gap: 8px; page-break-inside: avoid; }
  .card img { width: 200px; height: 200px; }
  .name { font-weight: 600; font-size: 14px; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #475569; }
  @media print { body { padding: 0; background: white; } h1 { display: none; } }
</style></head>
<body>
<h1>Bulk Card Tokens — ${result.created.length} employees</h1>
<div class="grid">${cards}</div>
<script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body></html>`);
    w.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrap}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Import Employees from CSV
          </DialogTitle>
          <DialogDescription>
            Bulk-create employees and auto-issue 2-year QR card tokens. Card
            tokens are shown once after import — print them before closing.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-1">
          <StepDot active={step >= 1} done={step > 1} label="Input" n={1} />
          <div className={cn("h-px flex-1", step > 1 ? "bg-primary/40" : "bg-border")} />
          <StepDot active={step >= 2} done={step > 2} label="Preview" n={2} />
          <div className={cn("h-px flex-1", step > 2 ? "bg-primary/40" : "bg-border")} />
          <StepDot active={step >= 3} done={step > 3} label="Result" n={3} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 px-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCsvText(SAMPLE_CSV)}
                  >
                    <Sparkles className="size-4" />
                    Load sample CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    Upload .csv file
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  {csvText && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCsvText("")}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="csvText">
                    Paste CSV text
                    <span className="text-muted-foreground font-normal ml-2 text-xs">
                      header: <code className="text-[11px]">employeeCode,fullName,departmentCode,designation,accessLevel</code>
                    </span>
                  </Label>
                  <Textarea
                    id="csvText"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={10}
                    placeholder={SAMPLE_CSV}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {totalCount > 0
                      ? `${totalCount} row${totalCount === 1 ? "" : "s"} detected`
                      : "No rows yet"}
                  </span>
                  <Button
                    type="button"
                    disabled={totalCount === 0}
                    onClick={() => setStep(2)}
                  >
                    Parse &amp; Preview
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 px-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {totalCount} total
                  </Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    {validCount} valid
                  </Badge>
                  {errorCount > 0 && (
                    <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                      {errorCount} errors
                    </Badge>
                  )}
                </div>

                {validCount === 0 && errorCount > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>No valid rows</AlertTitle>
                    <AlertDescription>
                      Fix the errors in your CSV and parse again before importing.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-md border border-border overflow-hidden">
                  <div className="max-h-[44vh] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                        <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="text-left font-medium py-2 px-3 w-10">#</th>
                          <th className="text-left font-medium py-2 px-3">Code</th>
                          <th className="text-left font-medium py-2 px-3">Full Name</th>
                          <th className="text-left font-medium py-2 px-3 hidden md:table-cell">Department</th>
                          <th className="text-left font-medium py-2 px-3 hidden sm:table-cell">Designation</th>
                          <th className="text-left font-medium py-2 px-3 w-16">Access</th>
                          <th className="text-left font-medium py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.map((r) => (
                          <tr
                            key={r.rowIndex}
                            className={cn(
                              "border-t border-border/40",
                              r.error
                                ? "bg-destructive/5"
                                : "hover:bg-accent/30",
                            )}
                          >
                            <td className="py-2 px-3 text-muted-foreground font-mono text-xs">
                              {r.rowIndex}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {r.employeeCode || <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2 px-3">{r.fullName || <span className="text-muted-foreground">—</span>}</td>
                            <td className="py-2 px-3 hidden md:table-cell text-muted-foreground text-xs">
                              {r.departmentCode || "—"}
                              {r.departmentName && (
                                <span className="text-foreground"> · {r.departmentName}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 hidden sm:table-cell text-muted-foreground text-xs">
                              {r.designation || "—"}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {r.accessLevelRaw ? r.accessLevel : "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.error ? (
                                <span className="text-destructive text-xs flex items-start gap-1">
                                  <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                                  <span>{r.error}</span>
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-emerald-600 border-emerald-500/40"
                                >
                                  OK
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="size-4" />
                    Back to edit
                  </Button>
                  <Button
                    type="button"
                    disabled={validCount === 0 || importMutation.isPending}
                    onClick={() => {
                      const validRows = parsed.rows.filter((r) => !r.error);
                      importMutation.mutate(validRows);
                    }}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Import {validCount} valid row{validCount === 1 ? "" : "s"}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && result && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 px-1"
              >
                <div className="grid grid-cols-3 gap-2">
                  <StatCard
                    label="Created"
                    value={result.successCount}
                    icon={<CheckCircle2 className="size-4" />}
                    tone="emerald"
                  />
                  <StatCard
                    label="Skipped"
                    value={result.skipped.length}
                    icon={<XCircle className="size-4" />}
                    tone="amber"
                  />
                  <StatCard
                    label="Errors"
                    value={result.errorCount}
                    icon={<AlertTriangle className="size-4" />}
                    tone="red"
                  />
                </div>

                {result.successCount > 0 && (
                  <>
                    <Alert>
                      <QrCode className="size-4" />
                      <AlertTitle>Card tokens issued</AlertTitle>
                      <AlertDescription>
                        Each employee below received a new 2-year QR card token.
                        Copy individual tokens or print all QR codes now — tokens
                        are only shown once.
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void printAll()}
                      >
                        <Printer className="size-4" />
                        Print all QR codes
                      </Button>
                    </div>

                    <div className="rounded-md border border-border overflow-hidden">
                      <div className="max-h-[40vh] overflow-y-auto scrollbar-thin">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                              <th className="text-left font-medium py-2 px-3">Code</th>
                              <th className="text-left font-medium py-2 px-3">Name</th>
                              <th className="text-left font-medium py-2 px-3">Card Token</th>
                              <th className="text-right font-medium py-2 px-3 w-20">Copy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.created.map((c) => (
                              <tr
                                key={c.id}
                                className="border-t border-border/40 hover:bg-accent/30"
                              >
                                <td className="py-2 px-3 font-mono text-xs">
                                  {c.employeeCode}
                                </td>
                                <td className="py-2 px-3">{c.fullName}</td>
                                <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                                  {truncate(c.cardToken, 24)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => {
                                      void navigator.clipboard
                                        .writeText(c.cardToken)
                                        .then(() => toast.success("Token copied"))
                                        .catch(() => toast.error("Copy failed"));
                                    }}
                                  >
                                    <Copy className="size-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {result.skipped.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="size-4" />
                      Skipped rows ({result.skipped.length})
                    </summary>
                    <ul className="mt-2 space-y-1 ml-6 list-disc text-muted-foreground">
                      {result.skipped.map((s, i) => (
                        <li key={i}>
                          Row {s.row} · <span className="font-mono">{s.employeeCode}</span> — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {result.errors.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="size-4" />
                      Validation errors ({result.errors.length})
                    </summary>
                    <ul className="mt-2 space-y-1 ml-6 list-disc text-muted-foreground">
                      {result.errors.map((e, i) => (
                        <li key={i}>
                          Row {e.row} — {e.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    onClick={() => onOpenChangeWrap(false)}
                  >
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step < 3 && (
          <DialogFooter className="border-t border-border pt-3">
            <div className="flex-1">
              <Progress
                value={step === 1 ? 33 : 66}
                className="h-1"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChangeWrap(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDot({
  active,
  done,
  label,
  n,
}: {
  active: boolean;
  done: boolean;
  label: string;
  n: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "size-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-colors",
          done
            ? "bg-primary text-primary-foreground border-primary"
            : active
              ? "bg-primary/15 text-primary border-primary/40"
              : "bg-muted text-muted-foreground border-border",
        )}
      >
        {done ? "✓" : n}
      </div>
      <span
        className={cn(
          "text-xs",
          active ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "red";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    red: "border-destructive/30 bg-destructive/5 text-destructive",
  } as const;
  return (
    <div className={cn("rounded-md border p-3 flex items-center gap-3", tones[tone])}>
      <div className="opacity-80">{icon}</div>
      <div>
        <div className="text-xl font-semibold leading-none">{value}</div>
        <div className="text-[11px] uppercase tracking-wider opacity-80 mt-1">
          {label}
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
