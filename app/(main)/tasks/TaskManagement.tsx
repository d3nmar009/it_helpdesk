"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Check, ChevronsUpDown, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getRowsPerPageOptions, normalizeRowsPerPage, type RowsPerPage } from "@/lib/pagination";

type StaffOption = { id: string; name: string };

type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "accepted" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
};

type TaskDetails = TaskRow & {
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  attachments: { id: string; filePath: string; createdAt: string; uploadedBy: { id: string; name: string } | null }[];
  comments: { id: string; comment: string; createdAt: string; user: { id: string; name: string } | null }[];
};

const PRIORITIES: TaskRow["priority"][] = ["low", "medium", "high", "urgent"];
const STATUSES: TaskRow["status"][] = ["pending", "accepted", "completed", "cancelled"];

function isImagePath(p: string) {
  const s = (p ?? "").toLowerCase();
  return s.endsWith(".png") || s.endsWith(".jpg") || s.endsWith(".jpeg") || s.endsWith(".webp") || s.endsWith(".gif");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function currentMonthRangeYmd() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toYmdLocal(from), to: toYmdLocal(to) };
}

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  description: z.string().max(5000, "Description is too long").optional(),
  assignedToId: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  createdAt: z.string().datetime().optional(),
});
type CreateSchema = z.infer<typeof createSchema>;

function PriorityBadge({ priority }: { priority: TaskRow["priority"] | string }) {
  const normalized = PRIORITIES.includes(priority as TaskRow["priority"]) ? (priority as TaskRow["priority"]) : null;
  const cls =
    normalized === "low"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
      : normalized === "medium"
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200"
        : normalized === "high"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          : normalized === "urgent"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200";
  return (
    <Badge variant="outline" className={cls}>
      {String(priority).toUpperCase()}
    </Badge>
  );
}

function StatusBadge({ status }: { status: TaskRow["status"] | string }) {
  const normalized = STATUSES.includes(status as TaskRow["status"]) ? (status as TaskRow["status"]) : null;
  const cls =
    normalized === "pending"
      ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
      : normalized === "accepted"
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200"
        : normalized === "completed"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
          : normalized === "cancelled"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200";
  return (
    <Badge variant="outline" className={cls}>
      {String(status).toUpperCase()}
    </Badge>
  );
}

export default function TaskManagement({
  currentUserId,
  staffOptions,
  initialTasks,
}: {
  currentUserId: string;
  staffOptions: StaffOption[];
  initialTasks: TaskRow[];
}) {
  const hasStaff = staffOptions.length > 0;
  const [tab, setTab] = useState<"own" | "staff">("own");

  const defaultMonth = currentMonthRangeYmd();

  const [tasks, setTasks] = useState<TaskRow[]>(() =>
    initialTasks.filter((t) => t.assignedTo?.id === currentUserId),
  );
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTask, setStatusTask] = useState<TaskRow | null>(null);
  const [statusAt, setStatusAt] = useState<string>(new Date().toISOString());
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);

  // staff-tab filters
  const [staffFilterOpen, setStaffFilterOpen] = useState(false);
  const [staffFilterId, setStaffFilterId] = useState<string>("");
  const [staffFrom, setStaffFrom] = useState<string>(defaultMonth.from);
  const [staffTo, setStaffTo] = useState<string>(defaultMonth.to);

  const [ownFrom, setOwnFrom] = useState<string>(defaultMonth.from);
  const [ownTo, setOwnTo] = useState<string>(defaultMonth.to);
  const [priorityFilter, setPriorityFilter] = useState<string>("__ALL__");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(20);

  const canAssignToStaff = staffOptions.length > 0;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateSchema>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: "",
      description: "",
      assignedToId: undefined,
      priority: "medium",
      createdAt: new Date().toISOString(),
    },
  });

  const assignedToId = watch("assignedToId");
  const selectedAssignee = useMemo(() => {
    if (!assignedToId) return null;
    if (assignedToId === currentUserId) return { id: currentUserId, name: "Me" };
    return staffOptions.find((s) => s.id === assignedToId) ?? null;
  }, [assignedToId, currentUserId, staffOptions]);

  async function loadOwnTasks() {
    const qs = new URLSearchParams({ scope: "own" });
    if (ownFrom) qs.set("from", ownFrom);
    if (ownTo) qs.set("to", ownTo);
    if (priorityFilter && priorityFilter !== "__ALL__") qs.set("priority", priorityFilter);
    if (statusFilter && statusFilter !== "__ALL__") qs.set("status", statusFilter);
    const res = await fetch(`/api/tasks?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load tasks (${res.status})`);
    }
    const data = (await res.json()) as TaskRow[];
    setTasks(data);
    setPage(1);
  }

  async function searchStaffTasks(opts?: { silent?: boolean }) {
    if (!staffFilterId) {
      if (!opts?.silent) toast.error("Please select a staff member.");
      return;
    }
    const qs = new URLSearchParams({ scope: "staff", assignedToId: staffFilterId });
    if (staffFrom) qs.set("from", staffFrom);
    if (staffTo) qs.set("to", staffTo);
    if (priorityFilter && priorityFilter !== "__ALL__") qs.set("priority", priorityFilter);
    if (statusFilter && statusFilter !== "__ALL__") qs.set("status", statusFilter);
    const res = await fetch(`/api/tasks?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load tasks (${res.status})`);
    }
    const data = (await res.json()) as TaskRow[];
    setTasks(data);
    setPage(1);
  }

  function openCreate() {
    setError(null);
    setMode("create");
    setActiveTask(null);
    reset({
      title: "",
      description: "",
      assignedToId: canAssignToStaff ? undefined : currentUserId,
      priority: "medium",
      createdAt: new Date().toISOString(),
    });
    setOpen(true);
  }

  function openEdit(t: TaskRow) {
    setError(null);
    setMode("edit");
    setActiveTask(t);
    reset({
      title: t.title,
      description: t.description ?? "",
      assignedToId: t.assignedTo?.id ?? (canAssignToStaff ? undefined : currentUserId),
      priority: t.priority,
      createdAt: t.createdAt,
    });
    setOpen(true);
  }

  function onDelete(t: TaskRow) {
    const ok = window.confirm(`Delete task "${t.title}"?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Delete failed (${res.status})`);
        }
        toast.success("Task deleted");
        if (tab === "own") {
          await loadOwnTasks();
        } else if (tab === "staff") {
          if (hasStaff && staffFilterId) await searchStaffTasks();
          else setTasks([]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(msg);
      }
    });
  }

  function openDetails(t: TaskRow) {
    setDetailsOpen(true);
    setDetails(null);
    setDetailsError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tasks/${t.id}`, { cache: "no-store" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Failed to load task (${res.status})`);
        }
        const j = (await res.json()) as TaskDetails;
        setDetails(j);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setDetailsError(msg);
      }
    });
  }

  function openStatusUpdate(t: TaskRow) {
    setStatusTask(t);
    setStatusAt(new Date().toISOString());
    setCompleteFiles([]);
    setStatusOpen(true);
  }

  function submitStatusUpdate() {
    if (!statusTask) return;
    const action = statusTask.status === "pending" ? "ACCEPT" : statusTask.status === "accepted" ? "COMPLETE" : null;
    if (!action) return;

    startTransition(async () => {
      try {
        const res =
          action === "COMPLETE" && completeFiles.length
            ? await (async () => {
                const fd = new FormData();
                fd.set("action", action);
                fd.set("at", statusAt);
                for (const f of completeFiles) fd.append("attachments", f);
                return await fetch(`/api/tasks/${statusTask.id}`, { method: "PATCH", body: fd });
              })()
            : await fetch(`/api/tasks/${statusTask.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, at: statusAt }),
              });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Update failed (${res.status})`);
        }
        toast.success(action === "ACCEPT" ? "Task accepted" : "Task completed");
        await loadOwnTasks();
        setStatusOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(msg);
      }
    });
  }

  const onSubmit = handleSubmit((values) => {
    if (canAssignToStaff && !values.assignedToId) {
      toast.error("Please select a staff member to assign the task to.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const payload = {
          title: values.title,
          description: values.description,
          assignedToId: canAssignToStaff ? values.assignedToId : currentUserId,
          priority: values.priority,
          createdAt: values.createdAt,
        };

        const res =
          mode === "edit" && activeTask
            ? await fetch(`/api/tasks/${activeTask.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
            : await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `${mode === "edit" ? "Update" : "Create"} failed (${res.status})`);
        }
        toast.success(mode === "edit" ? "Task updated" : "Task created");
        if (tab === "own") {
          await loadOwnTasks();
        } else if (tab === "staff") {
          // keep current staff filter results fresh when possible
          try {
            if (hasStaff && staffFilterId) await searchStaffTasks({ silent: true });
          } catch {
            // ignore
          }
        }
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  });

  // Auto-apply priority/status filters without clicking search
  useEffect(() => {
    startTransition(async () => {
      try {
        if (tab === "own") {
          await loadOwnTasks();
        } else if (tab === "staff" && hasStaff && staffFilterId) {
          await searchStaffTasks({ silent: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load tasks";
        setError(msg);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, statusFilter]);

  const totalRows = tasks.length;
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
  const pageRows = normalizedPageSize === "ALL" ? tasks : tasks.slice(startIndex, endIndex);
  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [20, 50]), [totalRows]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Task Management</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create and assign tasks to your staff.</p>
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
                <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              Tasks
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({tasks.length} entries)</span>
            </CardTitle>

            <div className="flex items-end justify-between gap-3 flex-wrap w-full sm:w-auto">
              <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isPending}>
                <Plus className="w-4 h-4" />
                Add Task
              </Button>

              <div className="grid gap-1 sm:ml-auto">
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

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                const next = (v === "staff" ? "staff" : "own") as "own" | "staff";
                setTab(next);
                setError(null);
                setPage(1);
                if (next === "own") {
                  startTransition(async () => {
                    try {
                      await loadOwnTasks();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Failed to load tasks";
                      setError(msg);
                    }
                  });
                } else if (next === "staff") {
                  // reset results until user searches
                  setTasks([]);
                }
              }}
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="own">Own Tasks</TabsTrigger>
                {hasStaff ? <TabsTrigger value="staff">Staff Tasks</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="own" />
              {hasStaff ? <TabsContent value="staff" /> : null}
            </Tabs>
          </div>

          {hasStaff && tab === "staff" ? (
            <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="grid gap-1 min-w-[260px]">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">Staff</Label>
                  <Popover open={staffFilterOpen} onOpenChange={setStaffFilterOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={staffFilterOpen}
                        className="w-full justify-between"
                        disabled={isPending}
                      >
                        <span className={cn("truncate text-left", !staffFilterId ? "text-slate-500 dark:text-slate-400" : undefined)}>
                          {staffOptions.find((s) => s.id === staffFilterId)?.name ?? "Select staff..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search staff..." />
                        <CommandList>
                          <CommandEmpty>No staff found.</CommandEmpty>
                          <CommandGroup>
                            {staffOptions.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  setStaffFilterId(s.id);
                                  setStaffFilterOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", staffFilterId === s.id ? "opacity-100" : "opacity-0")} />
                                {s.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">From</Label>
                  <Input
                    type="date"
                    value={staffFrom}
                    onChange={(e) => setStaffFrom(e.target.value)}
                    disabled={isPending}
                    className="w-[170px]"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">To</Label>
                  <Input
                    type="date"
                    value={staffTo}
                    onChange={(e) => setStaffTo(e.target.value)}
                    disabled={isPending}
                    className="w-[170px]"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">Priority</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter} disabled={isPending}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">All</SelectItem>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isPending}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">All</SelectItem>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await searchStaffTasks();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Failed to load tasks";
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
              >
                Search
              </Button>
              </div>

              
            </div>
          ) : null}

          {tab === "own" ? (
            <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="grid gap-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">From</Label>
                  <Input
                    type="date"
                    value={ownFrom}
                    onChange={(e) => setOwnFrom(e.target.value)}
                    disabled={isPending}
                    className="w-[170px]"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-300">To</Label>
                  <Input
                    type="date"
                    value={ownTo}
                    onChange={(e) => setOwnTo(e.target.value)}
                    disabled={isPending}
                    className="w-[170px]"
                  />
                </div>

              <div className="grid gap-1">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Priority</Label>
                <Select
                  value={priorityFilter}
                  onValueChange={setPriorityFilter}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All</SelectItem>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">All</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await loadOwnTasks();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Failed to load tasks";
                      setError(msg);
                      toast.error(msg);
                    }
                  });
                }}
              >
                Search
              </Button>
              </div>

              
            </div>
          ) : null}
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Assigned By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Priority
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
                {tasks.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={8}>
                      <EmptyState
                        title={tab === "staff" ? "No staff tasks found" : "No tasks yet"}
                        description={
                          tab === "staff"
                            ? "Choose a staff member and date range, then click Search."
                            : "Create your first task by clicking “Add Task”."
                        }
                        icon={ClipboardList}
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 max-w-[320px]">
                        <button
                          type="button"
                          onClick={() => openDetails(t)}
                          className="text-left font-semibold text-blue-700 hover:underline dark:text-blue-300 cursor-pointer truncate max-w-[300px]"
                          title="View task details"
                          disabled={isPending}
                        >
                          {t.title}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[420px]">
                        <div className="truncate">{t.description || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {t.assignedTo?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {t.createdBy?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <PriorityBadge priority={t.priority?.toUpperCase()} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {tab === "own" && (t.status === "pending" || t.status === "accepted") ? (
                          <button
                            type="button"
                            onClick={() => openStatusUpdate(t)}
                            className="inline-flex"
                            title="Update status"
                            disabled={isPending}
                          >
                            <StatusBadge status={t.status} />
                          </button>
                        ) : (
                          <StatusBadge status={t.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tab === "staff" && t.status !== "pending" ? null : (
                        <div className="flex items-center justify-center gap-2">

                          {t.status === "pending" && t.createdBy?.id === currentUserId ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isPending}
                              onClick={() => openEdit(t)}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Pencil className="h-4 w-4" />
                                Edit
                              </span>
                            </Button>
                          ) : null}

                          {t.createdBy?.id === currentUserId && t.status !== "accepted" && t.status !== "completed" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isPending}
                              onClick={() => onDelete(t)}
                              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </span>
                            </Button>
                          ) : null}
                        </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Showing <span className="font-semibold">{totalRows ? startIndex + 1 : 0}</span>–
              <span className="font-semibold">{endIndex}</span> of <span className="font-semibold">{totalRows}</span>
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
            <DialogTitle>{mode === "edit" ? "Update Task" : "Add Task"}</DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? `Update task${activeTask?.title ? `: ${activeTask.title}` : ""}`.trim()
                : "Create a new task. Status will be set to pending."}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Task title" {...register("title")} />
              {errors.title?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={5} placeholder="Task details (optional)" {...register("description")} />
              {errors.description?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Assign to</Label>
                {canAssignToStaff ? (
                  <Controller
                    control={control}
                    name="assignedToId"
                    render={({ field }) => (
                      <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={assigneeOpen}
                            className="w-full justify-between"
                            disabled={isPending}
                          >
                            <span
                              className={cn(
                                "truncate text-left",
                                !field.value ? "text-slate-500 dark:text-slate-400" : undefined,
                              )}
                            >
                              {selectedAssignee ? selectedAssignee.name : "Select staff..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search staff..." />
                            <CommandList>
                              <CommandEmpty>No staff found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="Me"
                                  onSelect={() => {
                                    field.onChange(currentUserId);
                                    setAssigneeOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === currentUserId ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  Me
                                </CommandItem>
                                {staffOptions.map((s) => (
                                  <CommandItem
                                    key={s.id}
                                    value={s.name}
                                    onSelect={() => {
                                      field.onChange(s.id);
                                      setAssigneeOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === s.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    {s.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                ) : (
                  <Button type="button" variant="outline" disabled className="justify-start">
                    No staff found — will assign to yourself
                  </Button>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
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
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Created at</Label>
              <Controller
                control={control}
                name="createdAt"
                render={({ field }) => {
                  const raw = field.value ? String(field.value) : "";
                  const parsed = raw ? new Date(raw) : null;
                  const safe = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
                  return (
                    <DateTimePicker
                      value={safe}
                      onChange={(d) => field.onChange(d ? d.toISOString() : new Date().toISOString())}
                      disabled={isPending}
                    />
                  );
                }}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">Task Details</DialogTitle>
            <DialogDescription className="text-sm">
              {details ? details.title : "Loading task..."}
            </DialogDescription>
          </DialogHeader>

          {detailsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{detailsError}</p>
            </div>
          ) : details ? (
            <div className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-950/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Title</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white break-words">{details.title}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <StatusBadge status={details.status} />
                    <PriorityBadge priority={details.priority} />
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Description</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                    {details.description?.trim() ? details.description : "-"}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Assigned To</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {details.assignedTo?.name ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Assigned By</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{details.createdBy?.name ?? "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Created at</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {new Date(details.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Accepted at</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {details.acceptedAt ? new Date(details.acceptedAt).toLocaleString() : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Accomplished at</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {details.completedAt ? new Date(details.completedAt).toLocaleString() : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">Cancelled at</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {details.cancelledAt ? new Date(details.cancelledAt).toLocaleString() : "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">Attachments</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {details.attachments.length} file{details.attachments.length === 1 ? "" : "s"}
                  </p>
                </div>

                {details.attachments.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No attachments.</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {details.attachments.map((a) => {
                      const isImg = isImagePath(a.filePath);
                      const fileName = a.filePath.split("/").pop() ?? a.filePath;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className="group rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-950/40"
                          onClick={() => {
                            if (isImg) {
                              setActiveImageSrc(a.filePath);
                              setImageOpen(true);
                            } else {
                              window.open(a.filePath, "_blank", "noreferrer");
                            }
                          }}
                        >
                          {isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.filePath} alt="Attachment" className="h-36 w-full rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-36 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                              Open file
                            </div>
                          )}
                          <p className="mt-2 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{fileName}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {a.uploadedBy?.name ? `By ${a.uploadedBy.name} • ` : ""}{new Date(a.createdAt).toLocaleString()}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">Comments</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {details.comments.length} comment{details.comments.length === 1 ? "" : "s"}
                  </p>
                </div>

                {details.comments.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No comments.</p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {details.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.user?.name ?? "Unknown user"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(c.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading...</p>
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

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>
              {statusTask
                ? statusTask.status === "pending"
                  ? `Accept task: ${statusTask.title}`
                  : statusTask.status === "accepted"
                    ? `Complete task: ${statusTask.title}`
                    : `Task: ${statusTask.title}`
                : "Update task status"}
            </DialogDescription>
          </DialogHeader>

          {statusTask ? (
            statusTask.status === "pending" || statusTask.status === "accepted" ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>{statusTask.status === "pending" ? "Accepted date/time" : "Completed date/time"}</Label>
                  <DateTimePicker
                    value={(() => {
                      const d = new Date(statusAt);
                      return Number.isNaN(d.getTime()) ? new Date() : d;
                    })()}
                    onChange={(d) => setStatusAt((d ?? new Date()).toISOString())}
                    disabled={isPending}
                  />
                </div>

                {statusTask.status === "accepted" ? (
                  <div className="grid gap-2">
                    <Label>Attachments (optional)</Label>
                    <input
                      type="file"
                      multiple
                      className="block w-full text-sm"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files ?? []);
                        e.currentTarget.value = "";
                        const combined = [...completeFiles, ...selected];
                        if (combined.length > 10) {
                          toast.error("Maximum of 10 attachments allowed.");
                          setCompleteFiles(combined.slice(0, 10));
                          return;
                        }
                        setCompleteFiles(combined);
                      }}
                      disabled={isPending}
                    />
                    {completeFiles.length ? (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {completeFiles.length} file{completeFiles.length === 1 ? "" : "s"} selected:{" "}
                        <span className="font-medium">{completeFiles.map((f) => f.name).join(", ")}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">You can attach files or images before completing.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">This task status cannot be updated here.</p>
            )
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading...</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitStatusUpdate}
              disabled={
                isPending ||
                !statusTask ||
                (statusTask.status !== "pending" && statusTask.status !== "accepted")
              }
            >
              {statusTask?.status === "pending" ? "Accept" : statusTask?.status === "accepted" ? "Complete" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

