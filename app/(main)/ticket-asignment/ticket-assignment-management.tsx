"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Edit, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { getRowsPerPageOptions, normalizeRowsPerPage, type RowsPerPage } from "@/lib/pagination";
type TicketRow = {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED";
  createdAt: string;
  category: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string; department: { id: string; name: string } | null };
  logs: { action: string | null; remarks: string | null }[];
};

type TicketDetails = {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED";
  createdAt: string;
  category: { id: string; name: string };
  createdBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  attachments: { id: string; fileName: string; filePath: string; mimeType: string; uploadedAt: string }[];
  logs: { id: string; action: string | null; remarks: string | null }[];
};

type AssignmentAction = "IN_PROGRESS" | "RESOLVED" | "FORWARDED";
const ACTION_LABELS: Record<AssignmentAction, string> = {
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  FORWARDED: "Forwarded to",
};

type StatusFilter = "__ALL__" | "APPROVED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const updateSchema = z
  .object({
    action: z.enum(["IN_PROGRESS", "RESOLVED", "FORWARDED"]),
    actionAt: z.string().datetime().optional(),
    forwardToId: z.string().uuid().optional(),
    logAction: z.string().max(120, "Action must be 120 characters or less").optional(),
    remarks: z.string().max(1000, "Remarks must be 1000 characters or less").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "FORWARDED" && !v.forwardToId) {
      ctx.addIssue({ code: "custom", message: "Please select IT staff to forward to.", path: ["forwardToId"] });
    }
    if (v.action === "RESOLVED" && !v.logAction?.trim()) {
      ctx.addIssue({ code: "custom", message: "Action is required when resolving.", path: ["logAction"] });
    }
  });
type UpdateSchema = z.infer<typeof updateSchema>;

function PriorityBadge({ priority }: { priority: TicketRow["priority"] }) {
  if (!priority) return <span className="text-slate-500">-</span>;

  const cls =
    priority === "LOW"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
      : priority === "MEDIUM"
        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200"
        : priority === "HIGH"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200";

  return (
    <Badge variant="outline" className={cls}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: TicketRow["status"] }) {
  const cls =
    status === "PENDING_APPROVAL"
      ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
      : status === "APPROVED"
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200"
        : status === "IN_PROGRESS"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          : status === "RESOLVED"
            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200"
            : status === "CLOSED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200";

  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}

function isPrivilegedRole(role: string) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

export default function TicketAssignmentManagement({
  role,
  itStaffUsers,
  initialTickets,
}: {
  role: string;
  itStaffUsers: { id: string; name: string }[];
  initialTickets: TicketRow[];
}) {
  const canUpdate = useMemo(() => isPrivilegedRole(role), [role]);

  const [tickets, setTickets] = useState<TicketRow[]>(initialTickets);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("__ALL__");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(20);
  const [open, setOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<TicketDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);

  const counts = useMemo(() => {
    const approved = tickets.filter((t) => t.status === "APPROVED").length; // not accepted
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const resolved = tickets.filter((t) => t.status === "RESOLVED").length;
    const closed = tickets.filter((t) => t.status === "CLOSED").length;
    return { approved, inProgress, resolved, closed };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === "__ALL__") return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const { handleSubmit, control, reset, watch, register, formState: { errors } } = useForm<UpdateSchema>({
    resolver: zodResolver(updateSchema),
    defaultValues: { action: "IN_PROGRESS", actionAt: new Date().toISOString(), logAction: "", remarks: "" },
  });
  const action = watch("action");

  async function refreshTickets() {
    const res = await fetch("/api/tickets/assigned", { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load tickets (${res.status})`);
    }
    const data = (await res.json()) as TicketRow[];
    setTickets(data);
    setPage(1);
  }

  function openUpdate(t: TicketRow) {
    setActiveTicket(t);
    setError(null);
    // Only allow the next action based on current status
    const nextDefaultAction: AssignmentAction =
      t.status === "APPROVED" ? "IN_PROGRESS" : t.status === "IN_PROGRESS" ? "RESOLVED" : "IN_PROGRESS";
    reset({
      action: nextDefaultAction,
      actionAt: new Date().toISOString(),
      forwardToId: undefined,
      logAction: "",
      remarks: "",
    });
    setOpen(true);
  }

  function openDetails(t: TicketRow) {
    setDetailsOpen(true);
    setDetails(null);
    setDetailsError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${t.id}`, { cache: "no-store" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Failed to load ticket (${res.status})`);
        }
        const j = (await res.json()) as TicketDetails;
        setDetails(j);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setDetailsError(msg);
      }
    });
  }

  const onSubmit = handleSubmit((values) => {
    if (!activeTicket) return;

    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(`/api/tickets/${activeTicket.id}/assignment`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: values.action,
            actionAt: values.actionAt,
            forwardToId: values.action === "FORWARDED" ? values.forwardToId : undefined,
            logAction: values.logAction,
            remarks: values.remarks,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Update failed (${res.status})`);
        }

        const j = (await res.json().catch(() => null)) as any;
        if (j?.forwarded && j?.newTicket?.ticketNo) {
          toast.success(`Forwarded. New ticket created (${j.newTicket.ticketNo})`);
        } else {
          toast.success(`Updated ${activeTicket.ticketNo}`);
        }
        await refreshTickets();
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  });

  const totalRows = filteredTickets.length;
  useEffect(() => {
    setPageSize((ps) => normalizeRowsPerPage(totalRows, ps, 20));
    setPage((p) => {
      const eff = normalizeRowsPerPage(totalRows, pageSize, 20);
      const effSize = eff === "ALL" ? Math.max(1, totalRows) : eff;
      const pages = eff === "ALL" ? 1 : Math.max(1, Math.ceil(totalRows / effSize));
      return Math.min(Math.max(1, p), pages);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRows]);

  const normalizedPageSize = useMemo(() => normalizeRowsPerPage(totalRows, pageSize, 20), [totalRows, pageSize]);
  const effectivePageSize = normalizedPageSize === "ALL" ? Math.max(1, totalRows) : normalizedPageSize;
  const totalPages = normalizedPageSize === "ALL" ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = Math.min(totalRows, startIndex + effectivePageSize);
  const pageTickets = normalizedPageSize === "ALL" ? filteredTickets : filteredTickets.slice(startIndex, endIndex);
  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [20, 50]), [totalRows]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket Assignment</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Tickets assigned to you. Update the status as you work on them.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : null}

      <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              Assigned Tickets
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({filteredTickets.length} entries)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="grid gap-1">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as StatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All statuses</SelectItem>
                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                    <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                    <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Rows per page</Label>
                <Select
                  value={normalizedPageSize === "ALL" ? "ALL" : String(normalizedPageSize)}
                  onValueChange={(v) => {
                    setPage(1);
                    if (v === "ALL") setPageSize("ALL");
                    else setPageSize(Number(v));
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-xs text-gray-600 dark:text-gray-300">Not accepted (APPROVED)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{counts.approved}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 dark:text-amber-200">In progress</p>
              <p className="text-xl font-semibold text-amber-900 dark:text-amber-100">{counts.inProgress}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900/40 dark:bg-green-950/30">
              <p className="text-xs text-green-800 dark:text-green-200">Resolved</p>
              <p className="text-xl font-semibold text-green-900 dark:text-green-100">{counts.resolved}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <p className="text-xs text-emerald-800 dark:text-emerald-200">Closed</p>
              <p className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{counts.closed}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Ticket No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Remarks
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Created
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-300" colSpan={12}>
                      No assigned tickets found.
                    </td>
                  </tr>
                ) : (
                  pageTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        <button
                          type="button"
                          onClick={() => openDetails(t)}
                          className="text-left font-semibold text-blue-700 hover:underline dark:text-blue-300 cursor-pointer"
                          title="View ticket details"
                          disabled={isPending}
                        >
                          {t.ticketNo}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[360px]">
                        <div className="truncate">{t.title}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[420px]">
                        <div className="truncate">{t.description}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{t.createdBy.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {t.createdBy.department?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{t.category.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[240px]">
                        <div className="truncate">{t.logs?.[0]?.action ?? "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[320px]">
                        <div className="truncate">{t.logs?.[0]?.remarks ?? "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center">
                          {t.status === "REJECTED" || t.status === "CLOSED" || t.status === "RESOLVED" ? null : (
                            <Button
                              type="button"
                              onClick={() => openUpdate(t)}
                              disabled={!canUpdate || isPending}
                              variant="outline"
                              size="sm"
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                              title={!canUpdate ? "Only ADMIN and IT_STAFF can update" : "Update status"}
                            >
                              <div className="flex items-center gap-2">
                                <Edit className="w-4 h-4" />
                                Update
                              </div>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Showing <span className="font-semibold">{totalRows ? startIndex + 1 : 0}</span>–
              <span className="font-semibold">{endIndex}</span> of{" "}
              <span className="font-semibold">{totalRows}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || currentPage <= 1 || normalizedPageSize === "ALL"}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Page <span className="font-semibold">{currentPage}</span> /{" "}
                <span className="font-semibold">{totalPages}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || currentPage >= totalPages || normalizedPageSize === "ALL"}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>
              {activeTicket ? `Update status for ${activeTicket.ticketNo}` : "Update status"}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label>Action</Label>
              <Controller
                control={control}
                name="action"
                render={({ field }) => {
                  const current = activeTicket?.status;
                  const options: AssignmentAction[] =
                    current === "APPROVED" ? ["IN_PROGRESS"] : current === "IN_PROGRESS" ? ["RESOLVED", "FORWARDED"] : [];

                  return (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!canUpdate || options.length === 0}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((a) => (
                          <SelectItem key={a} value={a}>
                            {ACTION_LABELS[a]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.action?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.action.message.toString()}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>
                {action === "IN_PROGRESS"
                  ? "Accepted date/time"
                  : action === "FORWARDED"
                    ? "Forwarded date/time"
                    : "Resolved date/time"}
              </Label>
              <Controller
                control={control}
                name="actionAt"
                render={({ field }) => {
                  const raw = field.value ? String(field.value) : "";
                  const parsed = raw ? new Date(raw) : null;
                  const safe = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
                  return (
                    <DateTimePicker
                      value={safe}
                      onChange={(d) => field.onChange(d ? d.toISOString() : undefined)}
                      disabled={!canUpdate || isPending}
                    />
                  );
                }}
              />
              {errors.actionAt?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.actionAt.message.toString()}</p>
              ) : null}
            </div>

            {activeTicket?.status === "IN_PROGRESS" ? (
              <>
                <div className="grid gap-2">
                  <Label>Action</Label>
                  <Input placeholder="e.g. Replaced LAN cable" {...register("logAction")} />
                  {errors.logAction?.message ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{errors.logAction.message.toString()}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label>Remarks</Label>
                  <Textarea rows={4} placeholder="Add remarks..." {...register("remarks")} />
                  {errors.remarks?.message ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{errors.remarks.message.toString()}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {action === "FORWARDED" ? (
              <div className="grid gap-2">
                <Label>Forward to (IT Staff)</Label>
                <Controller
                  control={control}
                  name="forwardToId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!canUpdate}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select IT staff" />
                      </SelectTrigger>
                      <SelectContent>
                        {itStaffUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.forwardToId?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{errors.forwardToId.message.toString()}</p>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canUpdate || isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Ticket Details</DialogTitle>
            <DialogDescription className="text-base">
              {details ? `Ticket ${details.ticketNo}` : "Loading ticket..."}
            </DialogDescription>
          </DialogHeader>

          {detailsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-base font-medium text-red-700 dark:text-red-300">{detailsError}</p>
            </div>
          ) : details ? (
            <div className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-950/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Title</p>
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white break-words">{details.title}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <StatusBadge status={details.status} />
                    <PriorityBadge priority={details.priority} />
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Description</p>
                  <p className="mt-2 text-base text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                    {details.description}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Category</p>
                    <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{details.category.name}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Created By</p>
                    <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{details.createdBy.name}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Assigned To</p>
                    <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">
                      {details.assignedTo?.name ?? "Not assigned"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Created</p>
                    <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">
                      {new Date(details.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">Attachments</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {details.attachments.length} file{details.attachments.length === 1 ? "" : "s"}
                  </p>
                </div>

                {details.attachments.length === 0 ? (
                  <p className="mt-2 text-base text-slate-600 dark:text-slate-300">No attachments.</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {details.attachments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="group rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-950/40"
                        onClick={() => {
                          setActiveImageSrc(a.filePath);
                          setImageOpen(true);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.filePath} alt={a.fileName} className="h-36 w-full rounded-lg object-cover" />
                        <p className="mt-2 truncate text-sm text-slate-700 dark:text-slate-200">{a.fileName}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">Ticket Log</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {details.logs?.length ?? 0} entr{(details.logs?.length ?? 0) === 1 ? "y" : "ies"}
                  </p>
                </div>

                {!details.logs || details.logs.length === 0 ? (
                  <p className="mt-2 text-base text-slate-600 dark:text-slate-300">No logs yet.</p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {details.logs.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <div className="grid gap-2">
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                              Action
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white whitespace-pre-wrap break-words">
                              {l.action?.trim() ? l.action : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                              Remarks
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                              {l.remarks?.trim() ? l.remarks : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-base text-slate-600 dark:text-slate-300">Loading...</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)} disabled={isPending}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle className="sr-only">Attachment</DialogTitle>
          </DialogHeader>
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageOpen(false)}
              className="absolute right-4 top-4 border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              Close
            </Button>
            {activeImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeImageSrc} alt="Attachment" className="h-full w-full object-contain" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


