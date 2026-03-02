"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getRowsPerPageOptions, normalizeRowsPerPage, type RowsPerPage } from "@/lib/pagination";

type EmployeeOption = {
  id: string;
  name: string;
  username: string;
  email: string;
  department: { id: string; name: string } | null;
  role: string | null;
  reportsToId: string | null;
  boss: { id: string; name: string } | null;
};

export default function StaffAssigningManagement({
  currentUserId,
  employeeOptions,
  initialMyStaff,
}: {
  currentUserId: string;
  employeeOptions: EmployeeOption[];
  initialMyStaff: EmployeeOption[];
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>(employeeOptions);
  const [myStaff, setMyStaff] = useState<EmployeeOption[]>(initialMyStaff);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(20);
  const [isPending, startTransition] = useTransition();

  const selectedEmployee = useMemo(
    () => employees.find((u) => u.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  async function refresh() {
    const res = await fetch("/api/staff-assigning", { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to refresh (${res.status})`);
    }
    const data = (await res.json()) as { employees: EmployeeOption[]; myStaff: EmployeeOption[] };
    setEmployees(data.employees);
    setMyStaff(data.myStaff);
    setSelectedEmployeeId("");
    setPage(1);
  }

  function addStaff() {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee.");
      return;
    }
    if (selectedEmployeeId === currentUserId) {
      toast.error("You cannot add yourself.");
      return;
    }
    if (selectedEmployee?.reportsToId === currentUserId) {
      toast.message(`${selectedEmployee.name} is already in your staff list.`);
      return;
    }
    if (selectedEmployee?.reportsToId) {
      toast.error(`Cannot assign ${selectedEmployee.name}. Boss already set to ${selectedEmployee.boss?.name ?? "another user"}.`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/staff-assigning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffId: selectedEmployeeId }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Failed to add staff (${res.status})`);
        }
        toast.success(selectedEmployee ? `Added ${selectedEmployee.name}` : "Staff added");
        await refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(msg);
      }
    });
  }

  function removeStaff(staffId: string, staffName: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/staff-assigning/${staffId}`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Failed to remove staff (${res.status})`);
        }
        toast.success(`Removed ${staffName}`);
        await refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(msg);
      }
    });
  }

  const totalRows = myStaff.length;
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
  const pageRows = normalizedPageSize === "ALL" ? myStaff : myStaff.slice(startIndex, endIndex);
  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [20, 50]), [totalRows]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Assigning</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select an employee and add them to your staff list.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              My Staff
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({myStaff.length} entries)</span>
            </CardTitle>

            <div className="flex w-full items-end justify-between gap-3 flex-wrap sm:w-auto">
              <div className="flex items-end gap-3 flex-wrap">
              <div className="grid gap-1 min-w-[320px]">
                <Label className="text-xs text-gray-600 dark:text-gray-300">Employee</Label>
                <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeeOpen}
                      className="w-full justify-between"
                      disabled={isPending}
                    >
                      <span className="truncate text-left">
                        {selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.username})` : "Select employee..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search employee..." />
                      <CommandList>
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          {employees.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={`${u.name} ${u.username} ${u.email}`}
                              onSelect={() => {
                                setSelectedEmployeeId(u.id);
                                setEmployeeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedEmployeeId === u.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm">{u.name}</p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {u.department?.name}
                                </p>
                                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                  Reports To:{" "}
                                  <span className={u.boss ? "font-medium text-slate-700 dark:text-slate-200" : undefined}>
                                    {u.boss?.name ?? "—"}
                                  </span>
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                type="button"
                onClick={addStaff}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isPending || !selectedEmployeeId || Boolean(selectedEmployee?.reportsToId)}
                title={
                  !selectedEmployeeId
                    ? "Select an employee first"
                    : selectedEmployee?.reportsToId
                      ? `Cannot add: Boss already set to ${selectedEmployee?.boss?.name ?? "another user"}`
                      : "Add as my staff"
                }
              >
                Add
              </Button>

              </div>

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
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Role
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {myStaff.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6" colSpan={6}>
                      <EmptyState
                        title="No staff yet"
                        description="Use the employee selector above to add staff."
                        icon={Users}
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{s.username}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{s.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{s.department?.name ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {s.role ? (
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                          >
                            {s.role}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          onClick={() => removeStaff(s.id, s.name)}
                          disabled={isPending}
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </span>
                        </Button>
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
    </div>
  );
}

