"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  CreditCard,
  Ban,
  ScanFace,
  History,
  Trash2,
  Loader2,
  QrCode,
  Copy,
  Printer,
  CheckCircle2,
  Fingerprint,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import type { EmployeeDTO, EmployeeDetail, ScanEventDTO } from "@/lib/types";
import { EmployeeDetailSheet } from "@/components/admin/views/employee-detail-sheet";
import { CsvImportDialog } from "@/components/admin/views/csv-import-dialog";
import {
  ViewContainer,
  EmptyState,
  TableSkeleton,
  ScoreBar,
} from "../lib/ui-bits";
import {
  accessLevelClass,
  cardStatusClass,
  decisionClass,
  formatDateTime,
  formatRelative,
  initials,
  copyToClipboard,
  asArray,
} from "../lib/admin-utils";

const PAGE_SIZE = 10;

export function EmployeesView() {
  const admin = useAppStore((s) => s.admin);
  const setSection = useAppStore((s) => s.setAdminSection);
  const setEnrollmentTargetId = useAppStore((s) => s.setEnrollmentTargetId);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const canEdit =
    admin?.role === "hr_admin" || admin?.role === "superadmin";
  const canRevoke =
    admin?.role === "security_officer" || admin?.role === "superadmin";
  const canDelete = canEdit;

  const { data: departmentsRaw } = useQuery({
    queryKey: ["departments"],
    queryFn: async () =>
      asArray<{ id: string; name: string; code: string }>(
        await apiClient.departments.list(),
      ),
  });
  const departments = departmentsRaw ?? [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "employees",
      page,
      search,
      deptFilter,
      statusFilter,
    ],
    queryFn: () =>
      apiClient.employees.list({
        page,
        q: search || undefined,
        department_id: deptFilter === "all" ? undefined : deptFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const employees = data?.items ?? [];

  // -------- dialog state --------
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeDTO | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<EmployeeDTO | null>(null);
  const [detailsData, setDetailsData] = useState<EmployeeDetail | null>(null);
  const [qrDialog, setQrDialog] = useState<{ token: string; employee: EmployeeDTO | EmployeeDetail } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<EmployeeDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDTO | null>(null);
  const [historyTarget, setHistoryTarget] = useState<EmployeeDTO | null>(null);

  // -------- mutations --------
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.employees.create(body),
    onSuccess: (res) => {
      toast.success(`Employee ${res.employee.fullName} created`);
      qc.invalidateQueries({ queryKey: ["employees"] });
      setCreateOpen(false);
      setQrDialog({ token: res.cardToken, employee: res.employee });
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Failed to create employee"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient.employees.update(id, body),
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditTarget(null);
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Update failed"),
  });

  const reissueMutation = useMutation({
    mutationFn: (id: string) => apiClient.employees.reissueCard(id),
    onSuccess: (res) => {
      toast.success("New card issued — previous token revoked");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setQrDialog({ token: res.cardToken, employee: res.employee });
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Reissue failed"),
  });

  const revokeMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { reason?: string; suspendFace?: boolean };
    }) => apiClient.employees.revoke(id, body),
    onSuccess: () => {
      toast.success("Card revoked and CRL bumped");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setRevokeTarget(null);
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Revoke failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.employees.remove(id),
    onSuccess: () => {
      toast.success("Employee deleted (soft-delete)");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setDeleteTarget(null);
    },
    onError: (e: { error?: string }) => toast.error(e?.error ?? "Delete failed"),
  });

  function startEnrollment(emp: EmployeeDTO) {
    setEnrollmentTargetId(emp.id);
    setSection("enrollment");
  }

  return (
    <ViewContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Employees
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data?.total ?? 0} total · manage cards, enrollment, and access levels
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add Employee
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or designation…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={deptFilter}
            onValueChange={(v) => {
              setDeptFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-52">
              <Filter className="size-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            description="Try adjusting your search or filters, or create a new employee."
            action={
              canEdit && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload className="size-4" />
                    Import CSV
                  </Button>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" />
                    Add Employee
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                  <th className="text-left font-medium py-3 px-4">Employee</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Department</th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Designation</th>
                  <th className="text-left font-medium py-3 px-4">Access</th>
                  <th className="text-left font-medium py-3 px-4">Card Status</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Face</th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Card Expires</th>
                  <th className="text-right font-medium py-3 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-border/40 hover:bg-accent/30 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openDetails(emp)}
                        className="flex items-center gap-3 text-left"
                      >
                        <Avatar className="size-9 border border-border">
                          {emp.photoUrl ? (
                            <AvatarImage src={emp.photoUrl} alt={emp.fullName} />
                          ) : null}
                          <AvatarFallback className="bg-primary/15 text-primary text-xs">
                            {initials(emp.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{emp.fullName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {emp.employeeCode}
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-xs hidden md:table-cell">
                      {emp.departmentName ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground hidden lg:table-cell">
                      {emp.designation ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", accessLevelClass(emp.accessLevel))}
                      >
                        L{emp.accessLevel}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", cardStatusClass[emp.cardStatus])}
                      >
                        {emp.cardStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {emp.faceEnrolled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <Fingerprint className="size-3.5" />
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Fingerprint className="size-3.5 opacity-50" />
                          None
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground hidden lg:table-cell tabular-nums">
                      {emp.cardExpiresAt
                        ? formatRelative(emp.cardExpiresAt)
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-60 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => openDetails(emp)}
                            className="cursor-pointer"
                          >
                            <Eye className="size-4" />
                            View Details
                          </DropdownMenuItem>
                          {canEdit && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setEditTarget(emp)}
                                className="cursor-pointer"
                              >
                                <CreditCard className="size-4" />
                                Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => reissueMutation.mutate(emp.id)}
                                className="cursor-pointer"
                                disabled={reissueMutation.isPending}
                              >
                                <CreditCard className="size-4" />
                                Reissue Card
                              </DropdownMenuItem>
                            </>
                          )}
                          {(canEdit || admin?.role === "hr_admin") && (
                            <DropdownMenuItem
                              onClick={() => startEnrollment(emp)}
                              className="cursor-pointer"
                            >
                              <ScanFace className="size-4" />
                              Enroll Face
                            </DropdownMenuItem>
                          )}
                          {canRevoke && (
                            <DropdownMenuItem
                              onClick={() => setRevokeTarget(emp)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Ban className="size-4" />
                              Revoke Card
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setHistoryTarget(emp)}
                            className="cursor-pointer"
                          >
                            <History className="size-4" />
                            Scan History
                          </DropdownMenuItem>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(emp)}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {data.total} total
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {createOpen && (
        <CreateEditDialog
          key="new-employee"
          open={createOpen}
          onOpenChange={setCreateOpen}
          departments={departments ?? []}
          onSubmit={(b) => createMutation.mutate(b)}
          loading={createMutation.isPending}
        />
      )}

      {editTarget && (
        <CreateEditDialog
          key={`edit-${editTarget.id}`}
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          departments={departments ?? []}
          employee={editTarget}
          onSubmit={(b) =>
            updateMutation.mutate({ id: editTarget.id, body: b })
          }
          loading={updateMutation.isPending}
        />
      )}

      <DetailsDialog
        target={detailsTarget}
        data={detailsData}
        setData={setDetailsData}
        onClose={() => {
          setDetailsTarget(null);
          setDetailsData(null);
        }}
      />

      <EmployeeDetailSheet
        employee={detailsTarget}
        detail={detailsData}
        open={!!detailsTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDetailsTarget(null);
            setDetailsData(null);
          }
        }}
      />

      <QrDialog
        token={qrDialog?.token ?? null}
        employee={qrDialog?.employee ?? null}
        onClose={() => setQrDialog(null)}
      />

      {revokeTarget && (
        <RevokeDialog
          employee={revokeTarget}
          loading={revokeMutation.isPending}
          onClose={() => setRevokeTarget(null)}
          onConfirm={(body) =>
            revokeMutation.mutate({ id: revokeTarget.id, body })
          }
        />
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="size-5 text-destructive" />
                Delete {deleteTarget.fullName}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This performs a soft-delete. The employee record will be anonymized
                to &ldquo;Deleted User&rdquo;, face embedding cleared, card token
                revoked, and access permanently disabled. Audit trail entries are
                retained immutably.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {historyTarget && (
        <ScanHistorySheet
          employee={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </ViewContainer>
  );

  async function openDetails(emp: EmployeeDTO) {
    setDetailsTarget(emp);
    setDetailsData(null);
    try {
      const d = await apiClient.employees.get(emp.id);
      setDetailsData(d);
    } catch (e) {
      const err = e as { error?: string };
      toast.error(err?.error ?? "Failed to load employee details");
    }
  }
}

// ============ Create / Edit dialog ============

function CreateEditDialog({
  open,
  onOpenChange,
  departments,
  employee,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: { id: string; name: string; code: string }[];
  employee?: EmployeeDTO | null;
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const isEdit = !!employee;
  const [fullName, setFullName] = useState(employee?.fullName ?? "");
  const [employeeCode, setEmployeeCode] = useState(employee?.employeeCode ?? "");
  const [departmentId, setDepartmentId] = useState<string>(
    employee?.departmentId ?? departments[0]?.id ?? "",
  );
  const [designation, setDesignation] = useState(employee?.designation ?? "");
  const [accessLevel, setAccessLevel] = useState<number>(employee?.accessLevel ?? 2);
  const [photoUrl, setPhotoUrl] = useState(employee?.photoUrl ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !employeeCode || !departmentId) {
      toast.error("Name, code, and department are required");
      return;
    }
    onSubmit({
      fullName,
      employeeCode,
      departmentId,
      designation: designation || undefined,
      accessLevel,
      photoUrl: photoUrl || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update profile and access level. Card token is unchanged."
              : "Creates a new employee record and issues a 2-year QR card token."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employeeCode">Employee Code</Label>
            <Input
              id="employeeCode"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="EMP-001"
              required
              className="font-mono"
              disabled={isEdit}
            />
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                Employee code cannot be changed after creation.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Engineer"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Access Level</Label>
              <Badge
                variant="outline"
                className={cn("text-[10px]", accessLevelClass(accessLevel))}
              >
                Level {accessLevel}
              </Badge>
            </div>
            <Slider
              value={[accessLevel]}
              min={1}
              max={5}
              step={1}
              onValueChange={(v) => setAccessLevel(v[0] ?? 2)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 · Visitor</span>
              <span>3 · Standard</span>
              <span>5 · Executive</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photoUrl">Photo URL (optional)</Label>
            <Input
              id="photoUrl"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…/jane.jpg"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ Details dialog ============

function DetailsDialog({
  target,
  data,
  setData,
  onClose,
}: {
  target: EmployeeDTO | null;
  data: EmployeeDetail | null;
  setData: (d: EmployeeDetail | null) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Employee Profile
          </DialogTitle>
        </DialogHeader>
        {target ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border-2 border-border">
                {target.photoUrl && <AvatarImage src={target.photoUrl} alt={target.fullName} />}
                <AvatarFallback className="bg-primary/15 text-primary text-lg">
                  {initials(target.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{target.fullName}</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {target.employeeCode}
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", accessLevelClass(target.accessLevel))}
                  >
                    L{target.accessLevel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", cardStatusClass[target.cardStatus])}
                  >
                    {target.cardStatus}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailRow label="Department" value={target.departmentName ?? "—"} />
              <DetailRow label="Designation" value={target.designation ?? "—"} />
              <DetailRow
                label="Face Enrolled"
                value={
                  data ? (data.faceEnrolled ? "Yes" : "No") : <Skeleton className="h-4 w-10" />
                }
              />
              <DetailRow
                label="Has PIN"
                value={data ? (data.hasPin ? "Yes" : "No") : <Skeleton className="h-4 w-10" />}
              />
              <DetailRow
                label="Scan Count"
                value={
                  data ? (
                    data.scanCount.toLocaleString()
                  ) : (
                    <Skeleton className="h-4 w-10" />
                  )
                }
              />
              <DetailRow
                label="Last Scan"
                value={
                  data ? (
                    formatRelative(data.lastScanAt)
                  ) : (
                    <Skeleton className="h-4 w-20" />
                  )
                }
              />
              <DetailRow
                label="Card Expires"
                value={formatDateTime(target.cardExpiresAt)}
              />
              <DetailRow label="Created" value={formatDateTime(target.createdAt)} />
            </div>
            {data?.cardTokenHash && (
              <div className="p-2 rounded-md bg-muted/40 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Card token hash (SHA-256)
                </p>
                <code className="text-[11px] font-mono break-all">
                  {data.cardTokenHash}
                </code>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

// ============ QR dialog ============

function QrDialog({
  token,
  employee,
  onClose,
}: {
  token: string | null;
  employee: EmployeeDTO | EmployeeDetail | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // QR is rendered LOCALLY — the card token must never be sent to a
  // third-party QR service (previously api.qrserver.com received the raw
  // credential in the URL).
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl("");
    if (!token) return;
    (async () => {
      try {
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(token, {
          width: 300,
          margin: 1,
          errorCorrectionLevel: "H", // ~30% damage tolerance per spec
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function copy() {
    if (!token) return;
    copyToClipboard(token).then((ok) => {
      if (ok) {
        setCopied(true);
        toast.success("Card token copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Copy failed — please copy manually");
      }
    });
  }

  function print() {
    if (!token || !employee || !qrDataUrl) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    w.document.write(`
      <html>
        <head>
          <title>SentinelKiosk Access Card · ${employee.fullName}</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; text-align: center; }
            .card { border: 2px dashed #10b981; border-radius: 16px; padding: 24px; max-width: 380px; margin: 0 auto; }
            h1 { margin: 0 0 4px; font-size: 18px; color: #047857; }
            h2 { margin: 0 0 16px; font-size: 14px; color: #555; font-weight: 400; }
            img { width: 220px; height: 220px; }
            .code { font-family: ui-monospace, monospace; font-size: 11px; color: #888; word-break: break-all; margin-top: 12px; padding: 8px; background: #f5f5f5; border-radius: 8px; }
            .footer { margin-top: 16px; font-size: 10px; color: #999; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>SentinelKiosk Access Card</h1>
            <h2>${employee.fullName} · ${employee.employeeCode}</h2>
            <img src="${qrDataUrl}" alt="QR code" />
            <div class="code">${token}</div>
            <div class="footer">Expires ${employee.cardExpiresAt ? new Date(employee.cardExpiresAt).toLocaleDateString() : "in 2 years"} · Confidential</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-5" />
            Card Issued Successfully
          </DialogTitle>
          <DialogDescription>
            {employee ? `${employee.fullName} · ${employee.employeeCode}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-xl bg-white border-2 border-border">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code"
                width={220}
                height={220}
              />
            ) : (
              <div className="w-[220px] h-[220px] bg-grid flex items-center justify-center text-center p-4">
                <span className="text-xs text-muted-foreground">
                  Generating QR…
                  <br />
                  Use the token string below.
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Present this QR at any kiosk to initiate verification. Token is HMAC-SHA256 signed and valid for 2 years.
          </p>
          <div className="w-full p-2.5 rounded-md bg-muted/40 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <QrCode className="size-3" />
              Card Token (do not share)
            </p>
            <code className="text-[11px] font-mono break-all">{token}</code>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={copy}>
              {copied ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy
            </Button>
            <Button variant="outline" className="flex-1" onClick={print}>
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ Revoke dialog ============

function RevokeDialog({
  employee,
  loading,
  onClose,
  onConfirm,
}: {
  employee: EmployeeDTO;
  loading: boolean;
  onClose: () => void;
  onConfirm: (body: { reason?: string; suspendFace?: boolean }) => void;
}) {
  const [reason, setReason] = useState("");
  const [suspendFace, setSuspendFace] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="size-5" />
            Revoke Card for {employee.fullName}
          </DialogTitle>
          <DialogDescription>
            The card token will be added to the revocation list (CRL) and all
            kiosks will reject it on next sync. This action is logged to the
            immutable audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Card reported lost by employee"
              rows={3}
            />
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/40 bg-warning/5">
            <Switch
              id="suspendFace"
              checked={suspendFace}
              onCheckedChange={setSuspendFace}
            />
            <label htmlFor="suspendFace" className="text-sm cursor-pointer flex-1">
              <span className="font-medium">Also suspend face enrollment</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clears the stored biometric embedding. Employee will need a new
                enrollment session before regaining access.
              </p>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm({ reason: reason || undefined, suspendFace })}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            <Ban className="size-4" />
            Revoke Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Scan history sheet ============

function ScanHistorySheet({
  employee,
  onClose,
}: {
  employee: EmployeeDTO;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["employee-scan-history", employee.id, page],
    queryFn: () => apiClient.employees.scanHistory(employee.id, page),
  });
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            Scan History · {employee.fullName}
          </SheetTitle>
          <SheetDescription>
            {employee.employeeCode} · {data?.total ?? 0} total scans
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={History}
              title="No scans recorded"
              description="This employee has not yet been verified at any kiosk."
            />
          ) : (
            <div className="space-y-2">
              {items.map((ev: ScanEventDTO) => (
                <ScanHistoryRow key={ev.id} ev={ev} />
              ))}
            </div>
          )}
        </div>
        {data && data.total > 20 && (
          <div className="border-t border-border p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScanHistoryRow({ ev }: { ev: ScanEventDTO }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-[10px]", decisionClass[ev.decision])}
            >
              {ev.decision.replace("_", " ")}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {ev.kioskId}
            </span>
            {ev.offline && (
              <Badge variant="outline" className="text-[10px]">
                offline
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {formatDateTime(ev.createdAt)}
          </p>
        </div>
        {ev.faceMatchScore != null && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs tabular-nums font-medium">
              {ev.faceMatchScore.toFixed(2)}
            </span>
            <ScoreBar value={ev.faceMatchScore} className="w-20" />
          </div>
        )}
      </div>
      {ev.faceMatchStatus && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Face: {ev.faceMatchStatus.replace("_", " ")}
          {ev.latencyMs != null && ` · ${ev.latencyMs}ms`}
        </p>
      )}
    </div>
  );
}
