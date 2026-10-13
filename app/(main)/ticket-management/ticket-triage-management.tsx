"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Edit, MessageSquare, Paperclip, Search, Ticket, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ticketPrioritySchema, ticketStatusSchema, ticketTriageSchema, type TicketTriageSchema } from "@/lib/formValidationSchemas";
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
  createdBy: { id: string; name: string, department?: { id: string; name: string } };
  attachmentCount?: number;
  commentCount?: number;
  action?: string | null;
  remarks?: string | null;
};

type TicketDetails = TicketRow & {
  attachments: { id: string; fileName: string; filePath: string; mimeType: string; uploadedAt: string }[];
  logs: {
    id: string;
    action: string | null;
    remarks: string | null;
    performedBy: { id: string; name: string } | null;
  }[];
  comments: {
    id: string;
    comment: string;
    createdAt: string;
    user: { id: string; name: string };
  }[];
};

const PRIORITIES = ticketPrioritySchema.options;
const STATUSES = ticketStatusSchema.options;
const TRIAGE_STATUSES = ["APPROVED", "REJECTED"] as const;
const FILTER_STATUSES = STATUSES

function isPrivilegedRole(role: string) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

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

export default function TicketTriageManagement({
  currentUserId,
  role,
  itStaffUsers,
  initialTickets,
}: {
  currentUserId: string;
  role: string;
  itStaffUsers: { id: string; name: string }[];
  initialTickets: TicketRow[];
}) {
  const canUpdate = useMemo(() => isPrivilegedRole(role), [role]);

  const [tickets, setTickets] = useState<TicketRow[]>(initialTickets);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(10);
  const [open, setOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [closeTicket, setCloseTicket] = useState<TicketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<TicketDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>("");

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("__ALL__"); // __ALL__ | __NONE__ | userId

  const {
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<TicketTriageSchema>({
    resolver: zodResolver(ticketTriageSchema),
    defaultValues: {
      priority: "MEDIUM",
      status: "APPROVED",
      assignedToId: null,
      approvedAt: new Date().toISOString(),
    },
  });

  const triageStatus = watch("status");

  async function refreshTickets(
    nextFrom = from,
    nextTo = to,
    nextStatus = statusFilter,
    nextAssignee = assigneeFilter,
  ) {
    const qs = new URLSearchParams();
    if (nextFrom) qs.set("from", nextFrom);
    if (nextTo) qs.set("to", nextTo);
    if (nextStatus && nextStatus !== "__ALL__") qs.set("status", nextStatus);
    if (nextAssignee && nextAssignee !== "__ALL__") qs.set("assignedToId", nextAssignee);

    const res = await fetch(`/api/tickets${qs.toString() ? `?${qs.toString()}` : ""}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load tickets (${res.status})`);
    }
    const data = (await res.json()) as TicketRow[];
    setTickets(data);
    setPage(1);
  }

  const totalRows = tickets.length;
  useEffect(() => {
    setPageSize((ps) => normalizeRowsPerPage(totalRows, ps, 10));
    // Clamp page if total pages shrinks
    setPage((p) => {
      const eff = normalizeRowsPerPage(totalRows, pageSize, 10);
      const effSize = eff === "ALL" ? Math.max(1, totalRows) : eff;
      const pages = eff === "ALL" ? 1 : Math.max(1, Math.ceil(totalRows / effSize));
      return Math.min(Math.max(1, p), pages);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRows]);

  const normalizedPageSize = useMemo(() => normalizeRowsPerPage(totalRows, pageSize, 10), [totalRows, pageSize]);
  const effectivePageSize = normalizedPageSize === "ALL" ? Math.max(1, totalRows) : normalizedPageSize;
  const totalPages = normalizedPageSize === "ALL" ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = Math.min(totalRows, startIndex + effectivePageSize);
  const pageTickets = normalizedPageSize === "ALL" ? tickets : tickets.slice(startIndex, endIndex);

  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [10, 25]), [totalRows]);

  function openDetails(t: TicketRow) {
    setDetailsOpen(true);
    setDetails(null);
    setDetailsError(null);
    setCommentText("");
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

  function submitComment() {
    const ticketId = details?.id;
    const text = commentText.trim();
    if (!ticketId) return;
    if (!text) {
      toast.error("Please enter a comment.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: text }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Failed to add comment (${res.status})`);
        }
        const created = (await res.json()) as TicketDetails["comments"][number];

        setDetails((prev) => (prev ? { ...prev, comments: [created, ...(prev.comments ?? [])] } : prev));
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, commentCount: (t.commentCount ?? 0) + 1 } : t)),
        );
        setCommentText("");
        toast.success("Comment added.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(msg);
      }
    });
  }

  function deleteComment(commentId: string) {
    const ticketId = details?.id;
    if (!ticketId) return;

    const ok = window.confirm("Delete this comment?");
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/comments/${commentId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Failed to delete comment (${res.status})`);
        }

        setDetails((prev) =>
          prev ? { ...prev, comments: (prev.comments ?? []).filter((c) => c.id !== commentId) } : prev,
        );
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId ? { ...t, commentCount: Math.max(0, (t.commentCount ?? 0) - 1) } : t,
          ),
        );
        toast.success("Comment deleted.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(msg);
      }
    });
  }

  function openUpdate(t: TicketRow) {
    setActiveTicket(t);
    setError(null);
    reset({
      priority: (t.priority ?? "MEDIUM") as any,
      status: (TRIAGE_STATUSES.includes(t.status as any) ? t.status : "APPROVED") as any,
      assignedToId: t.assignedTo?.id ?? null,
      approvedAt: new Date().toISOString(),
    });
    setOpen(true);
  }

  function openCloseModal(t: TicketRow) {
    setCloseTicket(t);
    setError(null);
    setCloseOpen(true);
  }

  function closeResolvedTicket() {
    if (!closeTicket) return;
    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(`/api/tickets/${closeTicket.id}/triage`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            priority: closeTicket.priority ?? "MEDIUM",
            status: "CLOSED",
            assignedToId: closeTicket.assignedTo?.id ?? null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Close failed (${res.status})`);
        }
        toast.success(`Closed ${closeTicket.ticketNo}`);
        await refreshTickets(from, to, statusFilter);
        setCloseOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const onSubmit = handleSubmit((values) => {
    if (!activeTicket) return;

    // Guard: when approving a PENDING_APPROVAL ticket, assignment is required.
    if (
      activeTicket.status === "PENDING_APPROVAL" &&
      values.status === "APPROVED" &&
      (!values.assignedToId || values.assignedToId === null)
    ) {
      toast.error("You cannot approve this ticket without assigning an IT Staff.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(`/api/tickets/${activeTicket.id}/triage`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Update failed (${res.status})`);
        }

        toast.success(`Updated ${activeTicket.ticketNo}`);
        await refreshTickets(from, to, statusFilter);
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  });

  function applyDateFilter() {
    startTransition(async () => {
      try {
        setError(null);
        await refreshTickets(from, to, statusFilter);
        toast.success("Filter applied");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function clearDateFilter() {
    setFrom("");
    setTo("");
    startTransition(async () => {
      try {
        setError(null);
        await refreshTickets("", "", statusFilter, assigneeFilter);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function onChangeStatusFilter(v: string) {
    setStatusFilter(v);
    startTransition(async () => {
      try {
        setError(null);
        await refreshTickets(from, to, v, assigneeFilter);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function onChangeAssigneeFilter(v: string) {
    setAssigneeFilter(v);
    startTransition(async () => {
      try {
        setError(null);
        await refreshTickets(from, to, statusFilter, v);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 py-4 sm:py-6 lg:min-h-0 lg:flex-1">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket Management</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Admin/IT Staff can update priority and status. Use date range to filter by created date.
              </p>
            </div>
          </div>
        </div>
      </div>
      {error ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : null}

      <Card className="min-w-0 gap-4 py-4 shadow-lg border-0 bg-white dark:bg-gray-800 lg:min-h-0 lg:flex-1">
        <CardHeader className="shrink-0 px-4 sm:px-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              Tickets
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({tickets.length} entries)
              </span>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="grid gap-1">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Status</Label>
                <Select value={statusFilter} onValueChange={onChangeStatusFilter}>
                  <SelectTrigger className="w-[210px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All statuses</SelectItem>
                    {FILTER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Assigned To</Label>
                <Select value={assigneeFilter} onValueChange={onChangeAssigneeFilter}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="All IT staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All</SelectItem>
                    <SelectItem value="__NONE__">Not assigned</SelectItem>
                    {itStaffUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
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
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col px-4 sm:px-6 lg:min-h-0 lg:flex-1">
          <div className="max-h-[70svh] min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 lg:max-h-none lg:flex-1">
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[150px]">
                    Actions
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[120px]">
                    Ticket No
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[180px]">
                    Title
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[200px]">
                    Description
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[130px]">
                    Created By
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[120px]">
                    Department
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[120px]">
                    Category
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[100px]">
                    Priority
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[160px]">
                    Status
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[110px]">
                    Files / Comments
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[150px]">
                    Action
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[170px]">
                    Remarks
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[130px]">
                    Assigned To
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 w-[170px]">
                    Created
                  </th>

                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tickets.length === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-center text-sm text-gray-600 dark:text-gray-300" colSpan={14}>
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  pageTickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          {t.status === "CLOSED" ? null : t.status === "RESOLVED" ? (
                            <Button
                              type="button"
                              onClick={() => openCloseModal(t)}
                              disabled={!canUpdate || isPending}
                              variant="outline"
                              size="sm"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                              title={!canUpdate ? "Only ADMIN and IT_STAFF can close tickets" : "Noted and close ticket"}
                            >
                              Noted and Close
                            </Button>
                          ) : t.status === "APPROVED" ? null : (
                            <Button
                              type="button"
                              onClick={() => openUpdate(t)}
                              disabled={!canUpdate || isPending}
                              variant="outline"
                              size="sm"
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                              title={!canUpdate ? "Only ADMIN and IT_STAFF can update" : "Update priority/status"}
                            >
                              <div className="flex items-center gap-2">
                                <Edit className="w-4 h-4" />
                                Update
                              </div>
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        <button
                          type="button"
                          onClick={() => openDetails(t)}
                          className="text-left font-semibold text-blue-700 hover:underline dark:text-blue-300 cursor-pointer"
                          title="View ticket details"
                        >
                          {t.ticketNo}
                        </button>
                      </td>

                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-[360px]">
                        <div className="truncate">{t.title}</div>
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-[420px]">
                        <div className="truncate">{t.description}</div>
                      </td>

                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {t.createdBy.name}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {t.createdBy.department?.name ?? "Not assigned"}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {t.category.name}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {(!t.attachmentCount || t.attachmentCount <= 0) && (!t.commentCount || t.commentCount <= 0) ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {t.attachmentCount && t.attachmentCount > 0 ? (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                                title={`${t.attachmentCount} attachment${t.attachmentCount === 1 ? "" : "s"}`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="h-3.5 w-3.5" />
                                  {t.attachmentCount}
                                </span>
                              </Badge>
                            ) : null}
                            {t.commentCount && t.commentCount > 0 ? (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                                title={`${t.commentCount} comment${t.commentCount === 1 ? "" : "s"}`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {t.commentCount}
                                </span>
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-[220px]">
                        {t.action?.trim() ? <div className="truncate" title={t.action}>{t.action}</div> : <span className="text-slate-500">-</span>}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100 max-w-[260px]">
                        {t.remarks?.trim() ? <div className="truncate" title={t.remarks}>{t.remarks}</div> : <span className="text-slate-500">-</span>}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {t.assignedTo?.name ?? "Not assigned"}
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex shrink-0 items-center justify-between gap-3 flex-wrap">
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
                disabled={isPending || currentPage <= 1}
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
                disabled={isPending || currentPage >= totalPages}
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
            <DialogTitle>Update Ticket</DialogTitle>
            <DialogDescription>
              {activeTicket ? `Update priority/status for ${activeTicket.ticketNo}` : "Update priority/status"}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canUpdate}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.priority?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.priority.message.toString()}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canUpdate}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIAGE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.status.message.toString()}</p>
              ) : null}
            </div>

            {triageStatus === "APPROVED" ? (
              <div className="grid gap-2">
                <Label>Approved date/time</Label>
                <Controller
                  control={control}
                  name="approvedAt"
                  render={({ field }) => {
                    const raw = field.value ? String(field.value) : "";
                    const parsed = raw ? new Date(raw) : null;
                    const safe = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
                    return (
                      <DateTimePicker
                        value={safe}
                        onChange={(d) => field.onChange(d ? d.toISOString() : new Date().toISOString())}
                        disabled={!canUpdate || isPending}
                      />
                    );
                  }}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Default is now.</p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Assigned To (IT Staff)</Label>
              <Controller
                control={control}
                name="assignedToId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "__NONE__"}
                    onValueChange={(v) => field.onChange(v === "__NONE__" ? null : v)}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select IT staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">Not assigned</SelectItem>
                      {itStaffUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.assignedToId?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.assignedToId.message.toString()}
                </p>
              ) : null}
            </div>

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

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Close Ticket</DialogTitle>
            <DialogDescription>
              {closeTicket ? `Close ticket ${closeTicket.ticketNo}?` : "Close ticket"}
            </DialogDescription>
          </DialogHeader>

          {closeTicket ? (
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="grid gap-2 text-sm">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Title</p>
                    <p className="font-medium text-slate-900 dark:text-white">{closeTicket.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</p>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                      {closeTicket.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Created By</p>
                      <p className="text-slate-700 dark:text-slate-200">{closeTicket.createdBy?.name ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Assigned To</p>
                      <p className="text-slate-700 dark:text-slate-200">{closeTicket.assignedTo?.name ?? "Not assigned"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCloseOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={closeResolvedTicket} disabled={!canUpdate || isPending}>
              Noted and Close Ticket
            </Button>
          </DialogFooter>
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
                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white break-words">
                      {details.title}
                    </p>
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

                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="grid divide-y divide-slate-200 dark:divide-slate-800">
                    <div className="flex items-start justify-between gap-4 py-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Category</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white text-right break-words">
                        {details.category.name}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Created By</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white text-right break-words">
                        {details.createdBy.name}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Assigned To</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white text-right break-words">
                        {details.assignedTo?.name ?? "Not assigned"}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Created</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white text-right break-words">
                        {new Date(details.createdAt).toLocaleString()}
                      </p>
                    </div>
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
                        <img
                          src={a.filePath}
                          alt={a.fileName}
                          className="h-36 w-full rounded-lg object-cover"
                        />
                        <p className="mt-2 truncate text-sm text-slate-700 dark:text-slate-200">{a.fileName}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">Ticket Actions</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {details.logs?.length ?? 0} record{(details.logs?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>

                {!details.logs || details.logs.length === 0 ? (
                  <p className="mt-2 text-base text-slate-600 dark:text-slate-300">No actions yet.</p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {details.logs.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Action</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white break-words">
                              {l.action?.trim() ? l.action : "-"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Performed by</p>
                            <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">
                              {l.performedBy?.name ?? "-"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Remarks</p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                            {l.remarks?.trim() ? l.remarks : "-"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">Comments</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {details.comments?.length ?? 0} comment{(details.comments?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-4 grid gap-2">
                  <Label>Add comment</Label>
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={4}
                    placeholder="Write a comment..."
                    disabled={isPending}
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button type="button" onClick={submitComment} disabled={isPending}>
                      Add Comment
                    </Button>
                  </div>
                </div>

                {!details.comments || details.comments.length === 0 ? (
                  <p className="mt-2 text-base text-slate-600 dark:text-slate-300">No comments.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {details.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.user?.name ?? "Unknown user"}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(c.createdAt).toLocaleString()}
                            </p>
                            {canUpdate || c.user?.id === currentUserId ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={isPending}
                                onClick={() => deleteComment(c.id)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete comment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                          {c.comment}
                        </p>
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
              <img
                src={activeImageSrc}
                alt="Attachment"
                className="h-full w-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


