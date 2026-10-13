"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Edit, Eye, EyeOff, KeyRound, Search, Users as UsersIcon } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  userAdminUpdateSchema,
  userPasswordResetSchema,
  type UserAdminUpdateSchema,
  type UserPasswordResetSchema,
} from "@/lib/formValidationSchemas";
import { getRowsPerPageOptions, normalizeRowsPerPage, type RowsPerPage } from "@/lib/pagination";

type RoleRow = { id: string; name: string };

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  department: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
};

function isAdmin(role: string) {
  return (role ?? "").toUpperCase() === "ADMIN";
}

function ActiveBadge({ active }: { active: boolean }) {
  const cls = active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200";
  return (
    <Badge variant="outline" className={cls}>
      {active ? "ACTIVE" : "INACTIVE"}
    </Badge>
  );
}

export default function UserMaintenance({
  role,
  roles,
  initialUsers,
}: {
  role: string;
  roles: RoleRow[];
  initialUsers: UserRow[];
}) {
  const canManage = useMemo(() => isAdmin(role), [role]);
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RowsPerPage>(20);
  const [open, setOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department?.name ?? "").toLowerCase().includes(q) ||
        (u.role?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UserAdminUpdateSchema>({
    resolver: zodResolver(userAdminUpdateSchema),
    defaultValues: { roleId: roles[0]?.id ?? "", isActive: true },
  });

  const passwordForm = useForm<UserPasswordResetSchema>({
    resolver: zodResolver(userPasswordResetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  function openChangePassword(u: UserRow) {
    setPasswordUser(u);
    setPasswordError(null);
    setShowPassword(false);
    passwordForm.reset({ password: "", confirmPassword: "" });
  }

  const onChangePassword = passwordForm.handleSubmit((values) => {
    if (!passwordUser) return;
    startTransition(async () => {
      try {
        setPasswordError(null);
        const res = await fetch(`/api/maintenance/users/${passwordUser.id}/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Password change failed (${res.status})`);
        }

        toast.success(`Password changed for ${passwordUser.username}`);
        setPasswordUser(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setPasswordError(msg);
        toast.error(msg);
      }
    });
  });

  async function refreshUsers() {
    const res = await fetch("/api/maintenance/users", { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as any;
      throw new Error(j?.error ?? `Failed to load users (${res.status})`);
    }
    const data = (await res.json()) as UserRow[];
    setUsers(data);
    setPage(1);
  }

  function openEdit(u: UserRow) {
    setActiveUser(u);
    setError(null);
    reset({
      roleId: u.role?.id ?? roles[0]?.id ?? "",
      isActive: u.isActive,
    });
    setOpen(true);
  }

  const onSubmit = handleSubmit((values) => {
    if (!activeUser) return;
    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(`/api/maintenance/users/${activeUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as any;
          throw new Error(j?.error ?? `Update failed (${res.status})`);
        }

        toast.success(`Updated user (${activeUser.username})`);
        await refreshUsers();
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(msg);
      }
    });
  });

  const totalRows = filtered.length;
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  const normalizedPageSize = useMemo(() => normalizeRowsPerPage(totalRows, pageSize, 20), [totalRows, pageSize]);
  const effectivePageSize = normalizedPageSize === "ALL" ? Math.max(1, totalRows) : normalizedPageSize;
  const totalPages = normalizedPageSize === "ALL" ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = Math.min(totalRows, startIndex + effectivePageSize);
  const pageRows = normalizedPageSize === "ALL" ? filtered : filtered.slice(startIndex, endIndex);
  const pageSizeOptions = useMemo(() => getRowsPerPageOptions(totalRows, [20, 50]), [totalRows]);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Maintenance • Users</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Activate accounts and assign roles. Only ADMIN can edit.
          </p>
        </div>
      </div>

      <Card className="border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/40">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              User List
            </CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Search by name, username, email, department, or role.
            </p>
          </div>

          <div className="flex items-center gap-2 items-end">
            <div className="relative w-[280px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-9"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-slate-600 dark:text-slate-300">Rows per page</Label>
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
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-600 dark:text-slate-300">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.department?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role?.name ?? "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={u.isActive} />
                    </TableCell>
                    <TableCell>{new Date(u.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(u)}
                          disabled={!canManage || isPending}
                          title={!canManage ? "Only ADMIN can edit users" : "Edit user"}
                        >
                          <Edit />
                          Update
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openChangePassword(u)}
                          disabled={!canManage || isPending}
                          title={!canManage ? "Only ADMIN can change passwords" : "Change password"}
                        >
                          <KeyRound />
                          Password
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

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
            <DialogTitle>Update User</DialogTitle>
            <DialogDescription>
              {activeUser ? `Manage ${activeUser.username}` : "Manage user"}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canManage}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roleId?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.roleId.message.toString()}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Account status</Label>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Select
                    value={field.value ? "ACTIVE" : "INACTIVE"}
                    onValueChange={(v) => field.onChange(v === "ACTIVE")}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.isActive?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">{errors.isActive.message.toString()}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canManage || isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordUser !== null} onOpenChange={(o) => !o && setPasswordUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              {passwordUser ? `Set a new password for ${passwordUser.name} (${passwordUser.username}).` : ""}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={onChangePassword}>
            {passwordError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">{passwordError}</p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="8 to 20 characters"
                  className="pr-10"
                  {...passwordForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.password?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordUser(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canManage || isPending}>
                {isPending ? "Saving..." : "Change password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


