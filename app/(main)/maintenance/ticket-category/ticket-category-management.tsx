"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Edit, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ticketCategorySchema, type TicketCategorySchema } from "@/lib/formValidationSchemas";
import { getRowsPerPageOptions, normalizeRowsPerPage, type RowsPerPage } from "@/lib/pagination";

type CategoryRow = { id: string; name: string };
type Mode = "create" | "edit";

function isAdmin(role: string) {
  return (role ?? "").toUpperCase() === "ADMIN";
}

export default function TicketCategoryManagement({
  role,
  initialCategories,
}: {
  role: string;
  initialCategories: CategoryRow[];
}) {
  const canManage = useMemo(() => isAdmin(role), [role]);
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(20);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [active, setActive] = useState<CategoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TicketCategorySchema>({
    resolver: zodResolver(ticketCategorySchema),
    defaultValues: { name: "" },
  });

  async function refreshCategories() {
    const res = await fetch("/api/ticket-categories", { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load categories (${res.status})`);
    }
    const data = (await res.json()) as CategoryRow[];
    setCategories(data);
    setPage(1);
  }

  function openCreate() {
    setMode("create");
    setActive(null);
    setError(null);
    reset({ name: "" });
    setOpen(true);
  }

  function openEdit(c: CategoryRow) {
    setMode("edit");
    setActive(c);
    setError(null);
    reset({ name: c.name });
    setOpen(true);
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        setError(null);
        if (!canManage) throw new Error("Forbidden");

        if (mode === "create") {
          const res = await fetch("/api/ticket-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as any;
            throw new Error(j?.error ?? `Create failed (${res.status})`);
          }
          toast.success("Category created");
        } else if (active) {
          const res = await fetch(`/api/ticket-categories/${active.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as any;
            throw new Error(j?.error ?? `Update failed (${res.status})`);
          }
          toast.success("Category updated");
        }

        await refreshCategories();
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  });

  function onDelete(c: CategoryRow) {
    startTransition(async () => {
      try {
        setError(null);
        if (!canManage) throw new Error("Forbidden");
        const ok = window.confirm(`Delete category "${c.name}"?`);
        if (!ok) return;

        const res = await fetch(`/api/ticket-categories/${c.id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Delete failed (${res.status})`);
        }
        toast.success("Category deleted");
        await refreshCategories();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const totalRows = categories.length;
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
  const pageRows = normalizedPageSize === "ALL" ? categories : categories.slice(startIndex, endIndex);
  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [20, 50]), [totalRows]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <span className="text-white font-bold">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket Category Maintenance</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create, update, and manage ticket categories.</p>
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
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">C</span>
              </div>
              Ticket Categories
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({categories.length} entries)</span>
            </CardTitle>

            <Button
              onClick={openCreate}
              disabled={!canManage}
              className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Category
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
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {categories.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={2}>
                      <EmptyState title="No categories yet" description="Create a ticket category to get started." />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            onClick={() => openEdit(c)}
                            disabled={!canManage || isPending}
                            variant="outline"
                            size="sm"
                            className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2">
                              <Edit className="w-4 h-4" />
                              Update
                            </div>
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onDelete(c)}
                            disabled={!canManage || isPending}
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
            <DialogTitle>{mode === "create" ? "Add Category" : "Update Category"}</DialogTitle>
            <DialogDescription>
              {mode === "create" ? "Create a new ticket category." : `Update category ${active?.name ?? ""}`.trim()}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="name">Category Name</Label>
              <Input id="name" placeholder="e.g. Hardware" {...register("name")} />
              {errors.name?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.name.message.toString()}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canManage || isPending}>
                {mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


