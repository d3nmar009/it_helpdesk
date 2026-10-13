"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Building2,
  Headset,
  LayoutDashboard,
  ListChecks,
  Tags,
  Ticket,
  TicketCheck,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { canAccessRoute } from "@/lib/routeAccess"

type NavItem = { title: string; url: string; icon: LucideIcon }

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Helpdesk",
    items: [
      { title: "Tickets", url: "/tickets", icon: Ticket },
      { title: "Ticket Management", url: "/ticket-management", icon: TicketCheck },
      { title: "Ticket Assignment", url: "/ticket-asignment", icon: UserCheck },
    ],
  },
  {
    label: "Workplan",
    items: [
      { title: "Task Management", url: "/tasks", icon: ListChecks },
      { title: "Staff Assigning", url: "/staff-assigning", icon: UserCog },
    ],
  },
  {
    label: "Maintenance",
    items: [
      { title: "Users", url: "/maintenance/users", icon: Users },
      { title: "Departments", url: "/maintenance/department", icon: Building2 },
      { title: "Ticket Categories", url: "/maintenance/ticket-category", icon: Tags },
    ],
  },
]

export function AppSidebar({ role }: { role?: string | null }) {
  const pathname = usePathname()
  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`)

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((item) => canAccessRoute(item.url, role)) }))
    .filter((s) => s.items.length > 0)

  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4 group-data-[collapsible=icon]:px-2">
        <a href="/tickets" className="flex items-center gap-3 overflow-hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-md shadow-black/20">
            <Image src="/favicon.png" alt="QUEZELCO1" width={24} height={24} className="size-6 object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold tracking-tight text-white">IT Helpdesk</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Workplan &amp; Accomplishment</p>
          </div>
        </a>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label} className="py-1">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="h-9 rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-md data-[active=true]:shadow-blue-950/40"
                    >
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <Headset className="size-5 shrink-0 text-sky-300" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold text-white">QUEZELCO1 IT Support</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Support. Plan. Deliver.</p>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
