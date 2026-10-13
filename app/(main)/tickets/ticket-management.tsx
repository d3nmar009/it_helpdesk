"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Check, ChevronsUpDown, Edit, Plus, Ticket, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import {
  ticketCreateSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketUpdateSchema,
  type TicketCreateSchema,
  type TicketUpdateSchema,
} from "@/lib/formValidationSchemas";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };
type UserOption = { id: string; name: string };

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
};

type TicketDetails = TicketRow & {
  createdBy: { id: string; name: string };
  attachments: { id: string; fileName: string; filePath: string; mimeType: string; uploadedAt: string }[];
  logs: { id: string; action: string | null; remarks: string | null }[];
};

type Mode = "create" | "edit";

const PRIORITIES = ticketPrioritySchema.options;
const STATUSES = ticketStatusSchema.options;

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

  return <Badge variant="outline" className={cls}>{priority}</Badge>;
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

  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

export default function TicketManagement({
  role,
  currentUserId,
  users,
  categories,
  initialTickets,
}: {
  role: string;
  currentUserId: string;
  users: UserOption[];
  categories: Category[];
  initialTickets: TicketRow[];
}) {
  const isUserRole = role?.toLowerCase() === "user";
  const isPrivilegedRole = useMemo(() => {
    const r = (role ?? "").toUpperCase();
    return r === "ADMIN" || r === "IT_STAFF";
  }, [role]);
  const [tickets, setTickets] = useState<TicketRow[]>(initialTickets);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(20);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [createdById, setCreatedById] = useState<string>(currentUserId);
  const [createdByOpen, setCreatedByOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<{ name: string; url: string }[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<TicketDetails["attachments"]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<TicketDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);

  useEffect(() => {
    const urls = attachments.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setAttachmentPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u.url));
    };
  }, [attachments]);

  const formSchema = useMemo(() => (mode === "create" ? ticketCreateSchema : ticketUpdateSchema), [mode]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TicketCreateSchema | TicketUpdateSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      priority: "MEDIUM",
      createdAt: "",
      ...(mode === "edit" ? { status: "PENDING_APPROVAL" } : {}),
    } as any,
  });

  async function refreshTickets() {
    const res = await fetch("/api/tickets", { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load tickets (${res.status})`);
    }
    const data = (await res.json()) as TicketRow[];
    setTickets(data);
    setPage(1);
  }

  function openCreate() {
    setMode("create");
    setActiveTicket(null);
    setError(null);
    if (isPrivilegedRole) setCreatedById(currentUserId);
    setAttachments([]);
    setExistingAttachments([]);
    setRemovedAttachmentIds([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    reset({
      title: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      priority: "MEDIUM",
      createdAt: isPrivilegedRole ? new Date().toISOString() : "",
    } as any);
    setOpen(true);
  }

  function openEdit(t: TicketRow) {
    setMode("edit");
    setActiveTicket(t);
    setError(null);
    setAttachments([]);
    setExistingAttachments([]);
    setRemovedAttachmentIds([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    reset({
      title: t.title,
      description: t.description,
      categoryId: t.category.id,
      priority: (t.priority ?? "MEDIUM") as any,
      status: t.status,
    } as any);
    setOpen(true);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${t.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as TicketDetails;
        setExistingAttachments(j.attachments ?? []);
      } catch {
        // ignore; attachments are optional
      }
    });
  }

  const totalRows = tickets.length;
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
  const pageTickets = normalizedPageSize === "ALL" ? tickets : tickets.slice(startIndex, endIndex);
  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [20, 50]), [totalRows]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        setError(null);
        if (mode === "create") {
          const fd = new FormData();
          fd.set("title", (values as any).title);
          fd.set("description", (values as any).description);
          fd.set("categoryId", (values as any).categoryId);
          fd.set("priority", (values as any).priority);
          if (isPrivilegedRole) fd.set("createdById", createdById);
          if (isPrivilegedRole && (values as any).createdAt) {
            const iso = new Date(String((values as any).createdAt)).toISOString();
            fd.set("createdAt", iso);
          }
          for (const f of attachments) fd.append("attachments", f);
          // console.log(Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, v instanceof File ? v.name : v])));
          // return
          const res = await fetch("/api/tickets", { method: "POST", body: fd });
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as any;
            throw new Error(j?.error ?? `Create failed (${res.status})`);
          }
          const created = (await res.json().catch(() => null)) as any;
          toast.success(
            created?.ticketNo ? `Ticket created (${created.ticketNo})` : "Ticket created successfully",
          );
        } else if (activeTicket) {
          const fd = new FormData();
          fd.set("title", (values as any).title);
          fd.set("description", (values as any).description);
          fd.set("categoryId", (values as any).categoryId);
          fd.set("priority", (values as any).priority);
          fd.set("status", (values as any).status);
          if (removedAttachmentIds.length) {
            fd.set("removeAttachmentIds", JSON.stringify(removedAttachmentIds));
          }
          for (const f of attachments) fd.append("attachments", f);

          const res = await fetch(`/api/tickets/${activeTicket.id}`, { method: "PUT", body: fd });
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as any;
            throw new Error(j?.error ?? `Update failed (${res.status})`);
          }
          toast.success(`Ticket updated (${activeTicket.ticketNo})`);
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

  function onDelete(t: TicketRow) {
    startTransition(async () => {
      try {
        setError(null);
        const ok = window.confirm(`Delete ticket ${t.ticketNo}?`);
        if (!ok) return;

        const res = await fetch(`/api/tickets/${t.id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Delete failed (${res.status})`);
        }

        await refreshTickets();
        toast.success(`Ticket deleted (${t.ticketNo})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
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

  return (
    <div className="flex min-w-0 flex-col gap-4 py-4 sm:py-6 lg:min-h-0 lg:flex-1">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tickets</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create, update, and manage helpdesk tickets.
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

            <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4" />
              Add Ticket
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
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
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col px-4 sm:px-6 lg:min-h-0 lg:flex-1">
          <div className="max-h-[70svh] min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 lg:max-h-none lg:flex-1">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead className="sticky top-0 z-10">
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
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Status
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
                {tickets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={9}>
                      <EmptyState
                        title="No tickets yet"
                        description="Create your first ticket by clicking “Add Ticket”."
                      />
                    </td>
                  </tr>
                ) : (
                  pageTickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        <button
                          type="button"
                          onClick={() => openDetails(t)}
                          className="text-left font-semibold text-blue-700 hover:underline dark:text-blue-300 cursor-pointer"
                          title="View ticket details"
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
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {t.category.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {t.assignedTo?.name ?? "Not assigned"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {["APPROVED", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(t.status) ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              onClick={() => openEdit(t)}
                              disabled={isPending}
                              variant="outline"
                              size="sm"
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                            >
                              <div className="flex items-center gap-2">
                                <Edit className="w-4 h-4" />
                                Update
                              </div>
                            </Button>
                            <Button
                              type="button"
                              onClick={() => onDelete(t)}
                              disabled={isPending}
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                            >
                              <div className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </div>
                            </Button>
                          </div>
                        )}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Ticket" : "Update Ticket"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Create a new helpdesk ticket."
                : `Update ticket ${activeTicket?.ticketNo ?? ""}`.trim()}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            {mode === "create" && isPrivilegedRole ? (
              <div className="grid gap-2">
                <Label>Created For</Label>
                <Popover open={createdByOpen} onOpenChange={setCreatedByOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={createdByOpen}
                      className="w-full justify-between"
                      disabled={isPending}
                    >
                      {users.find((u) => u.id === createdById)?.name ?? "Select user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search user..." />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={u.name}
                              onSelect={() => {
                                setCreatedById(u.id);
                                setCreatedByOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", createdById === u.id ? "opacity-100" : "opacity-0")} />
                              {u.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}

            {mode === "create" && isPrivilegedRole ? (
              <div className="grid gap-2">
                <Label htmlFor="createdAt">Ticket Date Created (optional)</Label>
                <Controller
                  control={control}
                  name={"createdAt" as any}
                  render={({ field }) => {
                    const raw = field.value ? String(field.value) : "";
                    const parsed = raw ? new Date(raw) : null;
                    const safe = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
                    return (
                      <DateTimePicker
                        value={safe}
                        onChange={(d) => field.onChange(d ? d.toISOString() : "")}
                        disabled={isPending}
                      />
                    );
                  }}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only ADMIN/IT Staff can set this. Leave blank to use the current date/time.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Short summary" {...register("title")} />
              {errors.title?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.title.message.toString()}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={5} placeholder="Describe the issue" {...register("description")} />
              {errors.description?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.description.message.toString()}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.categoryId?.message ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errors.categoryId.message.toString()}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      value={field.value as any}
                      onValueChange={field.onChange as any}
                      disabled={isUserRole && mode === "edit"}
                    >
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
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errors.priority.message.toString()}
                  </p>
                ) : null}
              </div>
            </div>

            {mode === "create" || mode === "edit" ? (
              <div className="grid gap-2">
                <Label>
                  Attachments (max 2 images){mode === "edit" ? " — you can remove/replace images" : ""}
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    e.currentTarget.value = "";

                    const keptExistingCount =
                      mode === "edit"
                        ? existingAttachments.filter((a) => !removedAttachmentIds.includes(a.id)).length
                        : 0;

                    const combined = [...attachments, ...selected];
                    if (keptExistingCount + combined.length > 2) {
                      toast.error("Maximum of 2 images allowed.");
                      const allowed = Math.max(0, 2 - keptExistingCount);
                      setAttachments(combined.slice(0, allowed));
                      return;
                    }

                    setAttachments(combined);
                  }}
                />

                {mode === "edit" ? (
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Current attachments</p>
                    {existingAttachments.filter((a) => !removedAttachmentIds.includes(a.id)).length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No existing attachments.</p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {existingAttachments
                          .filter((a) => !removedAttachmentIds.includes(a.id))
                          .slice(0, 2)
                          .map((a) => (
                            <div key={a.id} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.filePath}
                                alt={a.fileName}
                                className="h-24 w-24 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer"
                                onClick={(ev) => {
                                  ev.preventDefault();
                                  ev.stopPropagation();
                                  setActiveImageSrc(a.filePath);
                                  setImageOpen(true);
                                }}
                              />
                              <button
                                type="button"
                                className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                title="Remove image"
                                onClick={(ev) => {
                                  ev.preventDefault();
                                  ev.stopPropagation();
                                  setRemovedAttachmentIds((prev) => [...prev, a.id]);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-3 h-auto py-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                >
                  {attachmentPreviews.length === 0 ? (
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {mode === "edit" ? "Add up to 2 images…" : "Choose up to 2 images…"}
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {attachmentPreviews.slice(0, 2).map((p, idx) => (
                          <div key={p.url} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={p.name}
                              className="h-20 w-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveImageSrc(p.url);
                                setImageOpen(true);
                              }}
                            />
                            <span
                              role="button"
                              tabIndex={0}
                              className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                              title="Remove image"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAttachments((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAttachments((prev) => prev.filter((_, i) => i !== idx));
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {attachmentPreviews.length} new image{attachmentPreviews.length > 1 ? "s" : ""} selected
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {attachmentPreviews.map((p) => p.name).join(", ")}
                        </p>
                      </div>
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 dark:text-gray-400">Optional. Images only.</p>
              </div>
            ) : null}

            {/* Status removed from Update modal UI (still preserved in form state via reset()) */}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {mode === "create" ? "Create Ticket" : "Save Changes"}
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


