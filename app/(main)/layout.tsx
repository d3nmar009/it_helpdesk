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
        <SidebarInset className="px-5 min-h-screen flex flex-col">
          <Navbar />
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
          <div className="flex-1 flex flex-col">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
  );
}
