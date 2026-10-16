"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  FileSearch,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  WifiOff,
  Clock,
  UserX,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import type { ScanEventDTO, Decision, KioskDTO } from "@/lib/types";
import { LiveAuditFeed } from "@/components/admin/live-audit-feed";
import {
  ViewContainer,
  EmptyState,
  TableSkeleton,
  ScoreBar,
} from "../lib/ui-bits";
import {
  decisionClass,
  faceMatchStatusClass,
  formatDateTime,
  downloadCsv,
  asArray,
} from "../lib/admin-utils";

const DECISIONS: Decision[] = [
  "granted",
  "denied",
  "challenge_failed",
  "lockdown",
  "error",
  "supervisor_override",
];

// Human-readable descriptions for spoof/liveness flags shown in the detail drawer.
const spoofFlagDescriptions: Record<string, string> = {
  paper_detected: "A printed photo or paper face was detected in front of the camera.",
  screen_detected: "A screen/display replay attack was detected (phone/tablet held up).",
  mask_detected: "A 3D mask or non-live surface was detected.",
  liveness_failed: "The silent liveness check (MiniFASNet) scored below the 0.87 threshold.",
  challenge_failed: "The blink/turn challenge-response was not completed within the time window.",
  face_too_small: "The detected face was smaller than the 112px minimum.",
  multiple_faces: "More than one face was detected in the frame.",
  low_light: "Insufficient lighting degraded image quality below the threshold.",
  blur_detected: "Motion blur or defocus reduced sharpness below the Laplacian variance threshold.",
  replay_detected: "A repeated nonce/timestamp was detected (possible network replay).",
};

export function AuditView() {
  const admin = useAppStore((s) => s.admin);

  const [kioskFilter, setKioskFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [detailEvent, setDetailEvent] = useState<ScanEventDTO | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  const { data: kiosksRaw } = useQuery({
    queryKey: ["kiosks-list"],
    queryFn: async () =>
      asArray<KioskDTO>(await apiClient.kiosks.list()),
  });
  const kiosks = kiosksRaw ?? [];

  const { data, isLoading, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [
        "audit-scans",
        kioskFilter,
        decisionFilter,
        employeeSearch,
        dateFrom,
        dateTo,
      ],
      queryFn: ({ pageParam }) =>
        apiClient.audit.scans({
          kiosk_id: kioskFilter === "all" ? undefined : kioskFilter,
          decision: decisionFilter === "all" ? undefined : decisionFilter,
          from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
      placeholderData: (prev) => prev,
    });

  // Accumulate items across pages
  const items = (data?.pages ?? []).flatMap((p) => p.items);
  const totalCount = data?.pages?.[0]?.total ?? 0;
  const loadedCount = items.length;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(handleIntersect, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleIntersect]);

  // Auto-scroll the selected row into view on j/k navigation
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  // Keyboard navigation: j/k to move, Enter to open detail, Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (detailEvent) {
        if (e.key === "Escape") setDetailEvent(null);
        return;
      }
      if (items.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const ev = items[selectedIdx];
        if (ev) setDetailEvent(ev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedIdx, detailEvent]);

  // Reset selected index when filters change
  useEffect(() => {
    // The selection mirrors the active filter result set.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIdx(0);
  }, [kioskFilter, decisionFilter, employeeSearch, dateFrom, dateTo]);

  function resetFilters() {
    setKioskFilter("all");
    setDecisionFilter("all");
    setEmployeeSearch("");
    setDateFrom("");
    setDateTo("");
  }

  const [exporting, setExporting] = useState(false);

  async function exportCsv(all = false) {
    if (items.length === 0 && !all) {
      toast.error("No records to export");
      return;
    }
    if (all) {
      setExporting(true);
      try {
        // Fetch all matching records (up to 5000) across all pages
        const allItems: ScanEventDTO[] = [];
        let page = 1;
        const maxPages = 200; // 200 * 25 = 5000 max
        while (page <= maxPages) {
          const res = await apiClient.audit.scans({
            kiosk_id: kioskFilter === "all" ? undefined : kioskFilter,
            decision: decisionFilter === "all" ? undefined : decisionFilter,
            from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
            to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
            page,
          });
          allItems.push(...res.items);
          if (res.page >= res.totalPages) break;
          page += 1;
        }
        if (allItems.length === 0) {
          toast.error("No records to export");
          return;
        }
        writeCsv(allItems);
        toast.success(`Exported ${allItems.length} records to CSV (all matching)`);
      } catch {
        toast.error("Failed to export all records");
      } finally {
        setExporting(false);
      }
    } else {
      writeCsv(items);
      toast.success(`Exported ${items.length} records to CSV (loaded)`);
    }
  }

  function writeCsv(rows: ScanEventDTO[]) {
    const mapped = rows.map((e) => ({
      id: e.id,
      time: e.createdAt,
      kiosk: e.kioskId,
      employee_name: e.employeeName ?? "",
      employee_code: e.employeeCode ?? "",
      decision: e.decision,
      face_match_status: e.faceMatchStatus ?? "",
      face_match_score: e.faceMatchScore ?? "",
      latency_ms: e.latencyMs ?? "",
      offline: e.offline ? "true" : "false",
      spoof_flags: e.spoofFlags ? JSON.stringify(e.spoofFlags) : "",
      snapshot: e.snapshotPath ?? "",
      token_hash: e.tokenHash ?? "",
    }));
    downloadCsv(`audit-scans-${new Date().toISOString().slice(0, 10)}.csv`, mapped);
  }

  const activeFilters =
    kioskFilter !== "all" ||
    decisionFilter !== "all" ||
    employeeSearch ||
    dateFrom ||
    dateTo;

  return (
    <ViewContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSearch className="size-5 text-primary" />
            Audit Trail
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Immutable log of every scan event · {totalCount} records matching filters · {loadedCount} loaded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(false)} disabled={items.length === 0}>
            <Download className="size-4" />
            Export loaded ({loadedCount})
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => exportCsv(true)}
            disabled={exporting || totalCount === 0}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {exporting ? "Exporting…" : `Export all (${totalCount})`}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-[11px] text-muted-foreground">Employee search</Label>
            <Input
              placeholder="Name or code…"
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Kiosk</Label>
            <Select
              value={kioskFilter}
              onValueChange={(v) => {
                setKioskFilter(v);
              }}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="All kiosks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kiosks</SelectItem>
                {kiosks?.map((k) => (
                  <SelectItem key={k.id} value={k.kioskId}>
                    {k.kioskId} · {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Decision</Label>
            <Select
              value={decisionFilter}
              onValueChange={(v) => {
                setDecisionFilter(v);
              }}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="All decisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All decisions</SelectItem>
                {DECISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
              }}
              className="mt-1"
            />
          </div>
        </div>
        {activeFilters && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Filter className="size-3.5" />
              Filters active
            </p>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        )}
      </Card>

      {/* Results table + live feed */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={10} cols={7} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No scan events found"
            description="Adjust your filters or time range to find records. The audit trail retains every scan event immutably."
            action={
              activeFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                  <th className="text-left font-medium py-3 px-4 whitespace-nowrap">Time</th>
                  <th className="text-left font-medium py-3 px-4 whitespace-nowrap">Kiosk</th>
                  <th className="text-left font-medium py-3 px-4 whitespace-nowrap">Employee</th>
                  <th className="text-left font-medium py-3 px-4">Decision</th>
                  <th className="text-left font-medium py-3 px-4">Face</th>
                  <th className="text-left font-medium py-3 px-4">Score</th>
                  <th className="text-left font-medium py-3 px-4 whitespace-nowrap">Latency</th>
                  <th className="text-left font-medium py-3 px-4">Flags</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev, idx) => {
                  const hasSpoof = ev.spoofFlags && Object.keys(ev.spoofFlags).length > 0;
                  const isSelected = idx === selectedIdx;
                  return (
                    <tr
                      key={ev.id}
                      ref={isSelected ? selectedRowRef : undefined}
                      className={cn(
                        "border-b border-border/40 hover:bg-accent/30 cursor-pointer transition-colors",
                        isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/30"
                      )}
                      onClick={() => setDetailEvent(ev)}
                    >
                      <td className="py-2.5 px-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDateTime(ev.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs whitespace-nowrap">{ev.kioskId}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {ev.employeeName ? (
                          <div>
                            <div className="text-xs font-medium">{ev.employeeName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {ev.employeeCode}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <UserX className="size-3" />
                            Unknown
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", decisionClass[ev.decision])}
                        >
                          {ev.decision.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        {ev.faceMatchStatus ? (
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", faceMatchStatusClass[ev.faceMatchStatus])}
                          >
                            {ev.faceMatchStatus.replace("_", " ")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {ev.faceMatchScore != null ? (
                          <div className="flex items-center gap-2">
                            <ScoreBar value={ev.faceMatchScore} className="w-14" />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {ev.faceMatchScore.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {ev.latencyMs != null ? `${ev.latencyMs}ms` : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1">
                          {ev.offline && (
                            <span
                              title="Offline scan"
                              className="inline-flex items-center justify-center size-5 rounded bg-warning/15 text-warning-foreground"
                            >
                              <WifiOff className="size-3" />
                            </span>
                          )}
                          {hasSpoof && (
                            <span
                              title="Spoof flags detected"
                              className="inline-flex items-center justify-center size-5 rounded bg-destructive/15 text-destructive"
                            >
                              <ShieldAlert className="size-3" />
                            </span>
                          )}
                          {!ev.offline && !hasSpoof && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

        {/* Live audit stream */}
        <LiveAuditFeed />
      </div>

      {/* Pagination */}
      {/* Load more / infinite scroll sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center py-4 min-h-[60px]">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading more records…
          </div>
        ) : hasNextPage ? (
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            <ChevronRight className="size-4" />
            Load more records
          </Button>
        ) : loadedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            End of audit trail · {loadedCount} of {totalCount} records loaded
          </p>
        ) : null}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground py-1">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">j</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">k</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">Enter</kbd>
          open detail
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">Esc</kbd>
          close
        </span>
      </div>

      <EventDetailSheet event={detailEvent} onClose={() => setDetailEvent(null)} canViewSnapshot={!!admin} />
    </ViewContainer>
  );
}

// ============ Event detail sheet ============

function EventDetailSheet({
  event,
  onClose,
  canViewSnapshot,
}: {
  event: ScanEventDTO | null;
  onClose: () => void;
  canViewSnapshot: boolean;
}) {
  return (
    <Sheet open={!!event} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 overflow-y-auto scrollbar-thin">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            Scan Event #{event?.id}
          </SheetTitle>
          <SheetDescription>
            {event ? formatDateTime(event.createdAt) : ""}
          </SheetDescription>
        </SheetHeader>
        {event && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs", decisionClass[event.decision])}
              >
                {event.decision.replace("_", " ")}
              </Badge>
              {event.faceMatchStatus && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", faceMatchStatusClass[event.faceMatchStatus])}
                >
                  face: {event.faceMatchStatus.replace("_", " ")}
                </Badge>
              )}
              {event.offline && (
                <Badge variant="outline" className="bg-warning/15 text-warning-foreground border-warning/40 text-xs">
                  <WifiOff className="size-3" />
                  offline
                </Badge>
              )}
            </div>

            {/* Snapshot */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                <span>Snapshot</span>
                {canViewSnapshot && (
                  <span className="text-[9px] text-muted-foreground normal-case tracking-normal flex items-center gap-1">
                    <Eye className="size-2.5" />
                    view logged
                  </span>
                )}
              </p>
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border bg-grid">
                {/* Animated scanline */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-x-0 h-px bg-primary/30 animate-scanline" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-center p-6">
                  <div>
                    <Eye className="size-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-mono">
                      {event.snapshotPath ?? "no path"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      AES-256-GCM encrypted · MinIO
                    </p>
                  </div>
                </div>
                {canViewSnapshot && (
                  <div className="absolute inset-0 flex items-center justify-center bg-destructive/5 pointer-events-none">
                    <div className="rotate-[-12deg] text-[10px] font-bold text-destructive/30 tracking-widest border-2 border-destructive/30 px-3 py-1 rounded">
                      CONFIDENTIAL
                    </div>
                  </div>
                )}
                {!canViewSnapshot && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 pointer-events-none">
                    <div className="text-center">
                      <ShieldAlert className="size-6 text-muted-foreground mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">
                        Insufficient role to view snapshot
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Score & latency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Match Score
                </p>
                <p className="text-lg font-bold tabular-nums mt-1">
                  {event.faceMatchScore != null ? event.faceMatchScore.toFixed(3) : "—"}
                </p>
                {event.faceMatchScore != null && (
                  <ScoreBar value={event.faceMatchScore} className="mt-2" />
                )}
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" />
                  Latency
                </p>
                <p className="text-lg font-bold tabular-nums mt-1">
                  {event.latencyMs != null ? `${event.latencyMs}ms` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {event.offline ? "Synced later" : "Real-time"}
                </p>
              </div>
            </div>

            {/* Employee */}
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Employee
              </p>
              {event.employeeName ? (
                <div className="text-sm">
                  <p className="font-medium">{event.employeeName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {event.employeeCode ?? "—"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <UserX className="size-4" />
                  Unknown (token not recognized)
                </p>
              )}
            </div>

            {/* Kiosk */}
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Kiosk
              </p>
              <p className="font-mono text-sm">{event.kioskId}</p>
            </div>

            {/* Token hash */}
            {event.tokenHash && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Card Token Hash
                </p>
                <code className="text-[11px] font-mono break-all">
                  {event.tokenHash}
                </code>
              </div>
            )}

            {/* Spoof flags deep inspection */}
            {event.spoofFlags && Object.keys(event.spoofFlags).length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-[11px] uppercase tracking-wider text-destructive mb-2 flex items-center gap-1">
                  <ShieldAlert className="size-3" />
                  Spoof / Liveness Flags
                </p>
                <div className="space-y-1.5">
                  {Object.entries(event.spoofFlags).map(([key, val]) => {
                    const desc = spoofFlagDescriptions[key] ?? "Unknown flag";
                    const flagged = val === true || val === "true";
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-2 py-1.5",
                          flagged
                            ? "border-destructive/40 bg-destructive/10"
                            : "border-border bg-background/50"
                        )}
                      >
                        <div
                          className={cn(
                            "size-2 rounded-full mt-1 shrink-0",
                            flagged ? "bg-destructive" : "bg-muted-foreground"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[11px] font-mono font-semibold">
                              {key}
                            </code>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px]",
                                flagged
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {String(val)}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <details className="mt-2">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                    Raw JSON
                  </summary>
                  <pre className="text-[10px] font-mono whitespace-pre-wrap break-all mt-1 p-2 rounded bg-background/50">
                    {JSON.stringify(event.spoofFlags, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {/* Snapshot path */}
            {event.snapshotPath && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Snapshot Path
                </p>
                <code className="text-[11px] font-mono break-all">{event.snapshotPath}</code>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
