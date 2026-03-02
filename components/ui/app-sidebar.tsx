import { LayoutDashboard, List, Ticket, UserCheck, Building2, Tags } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { canAccessRoute } from "@/lib/routeAccess"

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Task Management",
    url: "/tasks",
    icon: List,
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: Ticket,
  },
  {
    title: "Ticket Management",
    url: "/ticket-management",
    icon: Ticket,
  },
  {
    title: "Ticket Assignment",
    url: "/ticket-asignment",
    icon: UserCheck,
  },
  {
    title: "Users",
    url: "/maintenance/users",
    icon: UserCheck,
  },
  {
    title: "Staff Assigning",
    url: "/staff-assigning",
    icon: UserCheck,
  },
  {
    title: "Departments",
    url: "/maintenance/department",
    icon: Building2,
  },
  {
    title: "Ticket Categories",
    url: "/maintenance/ticket-category",
    icon: Tags,
  },

]

export function AppSidebar({ role }: { role?: string | null }) {
  const visibleItems = items.filter((item) => canAccessRoute(item.url, role))

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>IT Helpdesk & Workplan Management System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
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
      </SidebarContent>
    </Sidebar>
  )
}