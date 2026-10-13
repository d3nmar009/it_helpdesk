
import { SidebarTrigger } from "@/components/ui/sidebar"

import PopoverAvatar from "./PopoverAvatar"
import { ThemeToggle } from "./ThemeToggle"
import DateTimeDisplay from "@/components/ui/DateTimeDisplay"
import { getSession } from "@/lib/auth"
import { NotificationBell } from "@/components/ui/notification-bell"
import { PageTitle } from "@/components/ui/page-title"
import { prisma } from "@/lib/prisma"

const Navbar = async () => {

  // const [session, setSession] = useState<any>({})
  const session = await getSession();
  const user = session.userId
    ? await prisma.users.findUnique({ where: { id: session.userId }, select: { name: true } })
    : null;

  

  return (
    <header className="flex h-16 w-full min-w-0 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-3 backdrop-blur-md transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-14 dark:border-slate-800 dark:bg-slate-900/70 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="size-9 shrink-0 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" />
        <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        <PageTitle />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <div className="hidden md:block">
          <DateTimeDisplay />
        </div>

        <NotificationBell userId={session.userId} />
        <ThemeToggle />

        <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="hidden min-w-0 max-w-[160px] text-right sm:block">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              {user?.name || session.username}
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
              {session.role?.replace(/_/g, " ")}
            </p>
          </div>
          <PopoverAvatar name={user?.name} username={session.username} role={session.role} />
        </div>
      </div>
    </header>
  )
}

export default Navbar
