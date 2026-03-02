"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateRangePicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: DateRange | undefined;
  onChange: (next: DateRange | undefined) => void;
  disabled?: boolean;
  className?: string;
}) {
  const label = React.useMemo(() => {
    if (!value?.from) return "Pick a date range";
    if (value.to) return `${format(value.from, "LLL dd, y")} - ${format(value.to, "LLL dd, y")}`;
    return format(value.from, "LLL dd, y");
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-[260px] justify-start text-left font-normal", !value?.from && "text-slate-500 dark:text-slate-400", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}

