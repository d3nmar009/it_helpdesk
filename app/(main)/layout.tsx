import Navbar from "@/components/ui/Navbar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from 'sonner'
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);

  return (
      <SidebarProvider>
        <AppSidebar role={session.role ?? "user"} />
        <SidebarInset className="app-shell h-svh min-w-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-background">
          <div className="no-print sticky top-0 z-20 shrink-0">
            <Navbar />
          </div>
          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              classNames: {
                // base surface
                toast: "border border-gray-200 dark:border-gray-800 shadow-md",
                title: "text-white",
                description: "text-white/90",
                // type backgrounds (flat colors)
                success: "bg-green-600 text-white",
                error: "bg-red-600 text-white",
                info: "bg-blue-600 text-white",
                warning: "bg-amber-500 text-white",
                loading: "bg-gray-700 text-white",
                default: "bg-gray-800 text-white",
              },
            }}
          />
          <div className="app-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-3 sm:px-5">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
  );
}
