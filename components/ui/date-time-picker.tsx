"use client";

import * as React from "react";
import { Calendar, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d: Date) {
  // local date (YYYY-MM-DD)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d: Date) {
  // local time (HH:MM)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromParts(dateStr: string, timeStr: string) {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM
  const [y, m, day] = dateStr.split("-").map((v) => Number(v));
  const [hh, mm] = timeStr.split(":").map((v) => Number(v));
  if (!y || !m || !day) return null;
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const d = new Date(y, m - 1, day, hh, mm, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const [dateStr, setDateStr] = React.useState<string>(() => (value ? toDateInputValue(value) : toDateInputValue(new Date())));
  const [timeStr, setTimeStr] = React.useState<string>(() => (value ? toTimeInputValue(value) : toTimeInputValue(new Date())));

  React.useEffect(() => {
    if (!open) return;
    const base = value ?? new Date();
    setDateStr(toDateInputValue(base));
    setTimeStr(toTimeInputValue(base));
  }, [open, value]);

  const label = React.useMemo(() => {
    if (!value) return "Select date & time";
    return value.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [value]);

  function commit(nextDateStr: string, nextTimeStr: string) {
    const d = fromParts(nextDateStr, nextTimeStr);
    onChange(d);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className={cn("truncate text-left", !value ? "text-slate-500 dark:text-slate-400" : undefined)}>
            {label}
          </span>
          <span className="ml-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 opacity-70" />
            <Clock className="h-4 w-4 opacity-70" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-3" align="start">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Date</label>
            <Input
              type="date"
              value={dateStr}
              onChange={(e) => {
                const v = e.target.value;
                setDateStr(v);
                commit(v, timeStr);
              }}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Time</label>
            <Input
              type="time"
              value={timeStr}
              onChange={(e) => {
                const v = e.target.value;
                setTimeStr(v);
                commit(dateStr, v);
              }}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                const now = new Date();
                const d = toDateInputValue(now);
                const t = toTimeInputValue(now);
                setDateStr(d);
                setTimeStr(t);
                onChange(now);
              }}
            >
              Now
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => {
                commit(dateStr, timeStr);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


