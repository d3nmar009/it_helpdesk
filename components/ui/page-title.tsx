"use client"

import { usePathname } from "next/navigation"

const TITLES: { prefix: string; section: string; title: string }[] = [
  { prefix: "/dashboard", section: "Overview", title: "Dashboard" },
  { prefix: "/tickets", section: "Helpdesk", title: "Tickets" },
  { prefix: "/ticket-management", section: "Helpdesk", title: "Ticket Management" },
  { prefix: "/ticket-asignment", section: "Helpdesk", title: "Ticket Assignment" },
  { prefix: "/accomplishment", section: "Reports", title: "Accomplishment Report" },
  { prefix: "/tasks", section: "Workplan", title: "Task Management" },
  { prefix: "/staff-assigning", section: "Workplan", title: "Staff Assigning" },
  { prefix: "/maintenance/users", section: "Maintenance", title: "Users" },
  { prefix: "/maintenance/department", section: "Maintenance", title: "Departments" },
  { prefix: "/maintenance/ticket-category", section: "Maintenance", title: "Ticket Categories" },
]

export function PageTitle() {
  const pathname = usePathname()
  const match = TITLES.find((t) => pathname === t.prefix || pathname.startsWith(`${t.prefix}/`))

  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {match?.section ?? "IT Helpdesk"}
      </p>
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
        {match?.title ?? "Workplan & Accomplishment"}
      </p>
    </div>
  )
}
