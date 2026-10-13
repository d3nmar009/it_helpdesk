"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MonthSelect, type MonthOption } from "@/components/dashboard/month-select";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Printer } from "lucide-react";

const ALL_ASSIGNED = "__ALL__";
const UNASSIGNED = "__UNASSIGNED__";

export type AccomplishmentRow = {
  id: string;
  title: string;
  description: string;
  approvedAt: string | null;
  resolvedAt: string | null;
  assignedTo: string | null;
  logs: { action: string | null; remarks: string | null }[];
};

export function AccomplishmentReport({
  rows,
  monthOptions,
  selectedMonth,
  monthLabel,
}: {
  rows: AccomplishmentRow[];
  monthOptions: MonthOption[];
  selectedMonth: string;
  monthLabel: string;
}) {
  const [assignToFilter, setAssignToFilter] = useState<string>(ALL_ASSIGNED);

  const assignToOptions = useMemo(() => {
    const names = new Set<string>();
    let hasUnassigned = false;
    for (const row of rows) {
      if (row.assignedTo) names.add(row.assignedTo);
      else hasUnassigned = true;
    }
    const options = [ALL_ASSIGNED, ...Array.from(names).sort()];
    if (hasUnassigned) options.push(UNASSIGNED);
    return options;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (assignToFilter === ALL_ASSIGNED) return rows;
    if (assignToFilter === UNASSIGNED) return rows.filter((r) => !r.assignedTo);
    return rows.filter((r) => r.assignedTo === assignToFilter);
  }, [rows, assignToFilter]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 no-print">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Month:</span>
          <MonthSelect
            value={selectedMonth}
            options={monthOptions}
            paramName="month"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Assign To:</span>
          <Select value={assignToFilter} onValueChange={setAssignToFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ASSIGNED}>All</SelectItem>
              {assignToOptions
                .filter((v) => v !== ALL_ASSIGNED && v !== UNASSIGNED)
                .map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              {assignToOptions.includes(UNASSIGNED) && (
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      <Card className="shadow-lg border-0 bg-white dark:bg-gray-800 print-content">
        <CardContent className="p-0">
          <div className="p-4 print:p-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 print:mb-2">
              Accomplishment Report
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 print:mb-2">
              {monthLabel} — Accomplish date (resolved)
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="whitespace-nowrap">Approved Date</TableHead>
                  <TableHead className="whitespace-nowrap">Resolved Date</TableHead>
                  <TableHead className="min-w-[140px]">Title</TableHead>
                  <TableHead className="min-w-[180px]">Description</TableHead>
                  <TableHead className="min-w-[180px]">Assign To</TableHead>
                  <TableHead className="min-w-[120px]">Action</TableHead>
                  <TableHead className="min-w-[160px]">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-8">
                      {rows.length === 0
                        ? "No accomplished tickets for this month."
                        : "No tickets match the selected Assign To filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id} className="border-slate-200 dark:border-slate-700">
                      <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300">
                        {row.approvedAt
                          ? format(new Date(row.approvedAt), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300">
                        {row.resolvedAt
                          ? format(new Date(row.resolvedAt), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top text-slate-800 dark:text-slate-200 min-w-[140px]">
                        {row.title}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300 min-w-[180px] max-w-md">
                        {row.description}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300 min-w-[120px] max-w-xs">
                        {row.assignedTo ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300 text-sm min-w-[120px] max-w-xs">
                        {row.logs.length > 0
                          ? row.logs
                              .map((l) => l.action ?? "—")
                              .filter(Boolean)
                              .join("; ") || "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300 text-sm min-w-[160px] max-w-md">
                        {row.logs.length > 0
                          ? row.logs
                              .map((l) => l.remarks ?? "—")
                              .filter(Boolean)
                              .join("; ") || "—"
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
