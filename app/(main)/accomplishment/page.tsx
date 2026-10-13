import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { prisma } from "@/lib/prisma";
import { ClipboardCheck } from "lucide-react";
import { AccomplishmentReport } from "./accomplishment-report";
import type { AccomplishmentRow } from "./accomplishment-report";
import type { MonthOption } from "@/components/dashboard/month-select";

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

function buildMonthOptions(count = 24): MonthOption[] {
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

export default async function AccomplishmentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = params.month && isValidMonth(params.month) ? params.month : defaultMonth;
  const { start, end } = monthStartEnd(month);
  const monthOptions = buildMonthOptions(24);

  const tickets = await prisma.ticket.findMany({
    where: {
      isDeleted: false,
      status: { in: ["RESOLVED", "CLOSED"] },
      OR: [
        { resolvedAt: { gte: start, lt: end } },
        { resolvedAt: null, closedAt: { gte: start, lt: end } },
      ],
    },
    orderBy: [{ resolvedAt: "desc" }, { closedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      approvedAt: true,
      resolvedAt: true,
      assignedTo: true,
      logs: { select: { action: true, remarks: true } },
    },
  });

  const rows: AccomplishmentRow[] = tickets.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    approvedAt: t.approvedAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    assignedTo: t.assignedTo?.name ?? null,

    logs: t.logs.map((l) => ({ action: l.action, remarks: l.remarks })),
  }));

  return (
    <div className="p-4 sm:p-8 min-h-full w-full">
      <div className="mb-6 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accomplishment Report</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View and print accomplished tickets by month.
            </p>
          </div>
        </div>
      </div>

      <AccomplishmentReport
        rows={rows}
        monthOptions={monthOptions}
        selectedMonth={month}
        monthLabel={monthLabel(month)}
      />
    </div>
  );
}
