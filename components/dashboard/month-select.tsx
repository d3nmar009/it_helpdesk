"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MonthOption = { value: string; label: string };

export function MonthSelect({
  value,
  options,
  paramName = "month",
}: {
  value: string;
  options: MonthOption[];
  paramName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set(paramName, v);
        router.push(`?${next.toString()}`);
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select month" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}




