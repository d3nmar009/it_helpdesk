
import { SidebarTrigger } from "@/components/ui/sidebar"

import PopoverAvatar from "./PopoverAvatar"
import { ThemeToggle } from "./ThemeToggle"
import DateTimeDisplay from "@/components/ui/DateTimeDisplay"
import { getSession } from "@/lib/auth"
import { NotificationBell } from "@/components/ui/notification-bell"

const Navbar = async () => {

  // const [session, setSession] = useState<any>({})
  const session = await getSession();

  

  return (
    <div className='flex mr-2 justify-between h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-slate-200 dark:border-slate-700'>
      <SidebarTrigger />
      {/* ICONS AND USER */}
      <div className='flex items-center gap-6 justify-end w-full'>

        
        {/* Date and Time Display */}
        <DateTimeDisplay />

        <NotificationBell userId={session.userId} />
        
        <div className='flex flex-col'>
          <span className="text-xs leading-3 font-medium">{session.username}</span>
          <span className="text-[10px] text-gray-500 text-right">{session.role}</span>
        </div>
        <ThemeToggle />
        <PopoverAvatar />
      </div>
    </div>
  )
}

export default Navbar