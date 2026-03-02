import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { canAccessRoute } from "@/lib/routeAccess";
import { prisma } from "@/lib/prisma";
import { MonthSelect, type MonthOption } from "@/components/dashboard/month-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, ClipboardList, Layers, TrendingUp, Users } from "lucide-react";

function isValidMonth(v: string) {
  return /^\d{4}-\d{2}$/.test(v);
}

function monthStartEnd(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

function monthLabel(month: string) {
  const d = new Date(`${month}-01T00:00:00.000Z`);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function buildMonthOptions(count = 12): MonthOption[] {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const out: MonthOption[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const value = `${yyyy}-${mm}`;
    out.push({ value, label: monthLabel(value) });
  }
  return out;
}

function hours(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 24) return `${n.toFixed(1)}h`;
  return `${(n / 24).toFixed(1)}d`;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent = "from-blue-500 to-purple-600",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
              {title}
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${accent} shadow-md flex items-center justify-center`}>
            {icon}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

function MiniBar({ value, className }: { value: number; className: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div className={`h-2 rounded-full ${className}`} style={{ width: `${v}%` }} />
    </div>
  );
}

function statusColor(status: string) {
  const s = status.toUpperCase();
  if (s === "RESOLVED") return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200";
  if (s === "CLOSED") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (s === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200";
  if (s === "APPROVED") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200";
  if (s === "REJECTED") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    redirect("/sign-in");
  }

  const role = (session.role ?? "").toUpperCase();
  if (role === "USER") {
    redirect("/tickets");
  }

  if (!canAccessRoute("/dashboard", session.role)) {
    redirect("/unauthorized?route=/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const monthParam = typeof sp.month === "string" ? sp.month : undefined;
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = monthParam && isValidMonth(monthParam) ? monthParam : defaultMonth;
  const { start, end } = monthStartEnd(month);

  const baseWhere = { isDeleted: false as const };
  const createdWhere = { ...baseWhere, createdAt: { gte: start, lt: end } };
  const completedWhere = {
    ...baseWhere,
    OR: [{ resolvedAt: { gte: start, lt: end } }, { closedAt: { gte: start, lt: end } }],
  };

  const [
    createdCount,
    completedCount,
    resolvedCount,
    statusGroups,
    categoryGroups,
    resolvedRows,
    itStaff,
    assignedGroups,
    accomplishedGroups,
  ] = await Promise.all([
    prisma.ticket.count({ where: createdWhere }),
    prisma.ticket.count({ where: completedWhere }),
    prisma.ticket.count({ where: { ...baseWhere, resolvedAt: { gte: start, lt: end } } }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: createdWhere,
      _count: { id: true },
    }),
    prisma.ticket.groupBy({
      by: ["categoryId"],
      where: createdWhere,
      _count: { id: true },
    }),
    prisma.ticket.findMany({
      where: { ...baseWhere, resolvedAt: { gte: start, lt: end } },
      select: { createdAt: true, resolvedAt: true },
      take: 5000,
      orderBy: { resolvedAt: "desc" },
    }),
    prisma.users.findMany({
      where: {
        isActive: true,
        role: { OR: [{ name: "IT_STAFF" }, { name: "ADMIN" }] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.ticket.groupBy({
      by: ["assignedToId"],
      where: { ...baseWhere, createdAt: { gte: start, lt: end }, assignedToId: { not: null } },
      _count: { id: true },
    }),
    prisma.ticket.groupBy({
      by: ["assignedToId"],
      where: {
        ...baseWhere,
        createdAt: { gte: start, lt: end },
        resolvedAt: { gte: start, lt: end },
        assignedToId: { not: null },
      },
      _count: { id: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;
  const resolvedThisMonth = (statusCounts.RESOLVED ?? 0) + 0; // created+resolved within month (status snapshot for created tickets)

  const completionRate = createdCount > 0 ? (completedCount / createdCount) * 100 : 0;

  const avgResolveHours = (() => {
    const rows = resolvedRows.filter((r) => r.resolvedAt && r.createdAt);
    if (rows.length === 0) return NaN;
    const totalMs = rows.reduce((acc, r) => acc + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0);
    return totalMs / rows.length / (1000 * 60 * 60);
  })();

  const assignedByUser = new Map<string, number>();
  for (const g of assignedGroups) {
    if (g.assignedToId) assignedByUser.set(g.assignedToId as string, g._count.id);
  }
  const accomplishedByUser = new Map<string, number>();
  for (const g of accomplishedGroups) {
    if (g.assignedToId) accomplishedByUser.set(g.assignedToId as string, g._count.id);
  }
  const totalAssigned = Array.from(assignedByUser.values()).reduce((a, b) => a + b, 0);

  const staffPerf = itStaff.map((u) => {
    const assigned = assignedByUser.get(u.id) ?? 0;
    const accomplished = accomplishedByUser.get(u.id) ?? 0;
    const assignedPct = totalAssigned > 0 ? (assigned / totalAssigned) * 100 : 0;
    const accomplishPct = assigned > 0 ? (accomplished / assigned) * 100 : 0;
    return { ...u, assigned, accomplished, assignedPct, accomplishPct };
  });

  const categoryIds = categoryGroups.map((g) => g.categoryId);
  const categories = await prisma.ticketCategories.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryBreakdown = categoryGroups
    .map((g) => ({
      categoryId: g.categoryId,
      name: categoryNameById.get(g.categoryId) ?? "Unknown",
      count: g._count.id,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const monthOptions = buildMonthOptions(12);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ticket accomplishments and operational summary.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Month</p>
              <MonthSelect value={month} options={monthOptions} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tickets created"
          value={String(createdCount)}
          subtitle={`Created in ${monthLabel(month)}`}
          icon={<ClipboardList className="h-5 w-5 text-white" />}
          accent="from-blue-500 to-indigo-600"
        />
        <StatCard
          title="Tickets completed"
          value={String(completedCount)}
          subtitle="Resolved or closed this month"
          icon={<CheckCircle2 className="h-5 w-5 text-white" />}
          accent="from-emerald-500 to-green-600"
        />
        <StatCard
          title="Completion rate"
          value={createdCount ? `${Math.round(completionRate)}%` : "—"}
          subtitle="Completed ÷ created (same month)"
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          accent="from-purple-500 to-pink-600"
        />
        <StatCard
          title="Avg. resolution time"
          value={Number.isFinite(avgResolveHours) ? hours(avgResolveHours) : "—"}
          subtitle="For tickets resolved this month"
          icon={<Clock className="h-5 w-5 text-white" />}
          accent="from-amber-500 to-orange-600"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-0 shadow-lg bg-white dark:bg-gray-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span>Status breakdown</span>
              </div>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                {monthLabel(month)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-700 dark:text-slate-200 font-medium">Accomplishment progress</p>
                <p className="text-slate-600 dark:text-slate-300">
                  {completedCount} / {createdCount || 0}
                </p>
              </div>
              <ProgressBar value={completionRate} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(statusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={statusColor(status)}>
                        {status}
                      </Badge>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{count}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Count of tickets created in the month (current status).
                    </p>
                  </div>
                ))}
              {Object.keys(statusCounts).length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:col-span-2 xl:col-span-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">No tickets for this month.</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="flex-1">IT Staff Performance</span>
              <Badge
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
              >
                {monthLabel(month)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:border-slate-700 dark:from-purple-950/30 dark:to-pink-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                    Month totals
                  </p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    Assigned: <span className="font-semibold">{totalAssigned}</span> • Resolved:{" "}
                    <span className="font-semibold">{resolvedCount}</span>
                  </p>
                </div>
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
                  RESOLVED
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 max-h-[420px] overflow-auto pr-1">
              {staffPerf.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{u.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Assigned share: <span className="font-semibold">{Math.round(u.assignedPct)}%</span>
                        {" • "}
                        Accomplishment:{" "}
                        <span className="font-semibold">
                          {u.assigned ? `${Math.round(u.accomplishPct)}%` : "—"}
                        </span>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                      title="Resolved / Assigned (this month)"
                    >
                      {u.accomplished}/{u.assigned} RESOLVED
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <div className="grid gap-1">
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Assigned workload share</p>
                      <MiniBar value={u.assignedPct} className="bg-gradient-to-r from-purple-500 to-pink-600" />
                    </div>
                    <div className="grid gap-1">
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Resolved rate (of assigned)</p>
                      <MiniBar value={u.assigned ? u.accomplishPct : 0} className="bg-gradient-to-r from-emerald-500 to-green-600" />
                    </div>
                  </div>
                </div>
              ))}
              {staffPerf.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">No IT staff users found.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Category distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">No tickets for this month.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {categoryBreakdown.map((c) => (
                  <div key={c.categoryId} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{c.count}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Tickets created</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


