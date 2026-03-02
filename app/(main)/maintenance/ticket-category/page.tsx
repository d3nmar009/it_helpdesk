import { prisma } from "@/lib/prisma";
import TicketCategoryManagement from "./ticket-category-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { type SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";
import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/routeAccess";

export default async function MaintenanceTicketCategoryPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) redirect("/sign-in");
  if (!canAccessRoute("/maintenance/ticket-category", session.role)) {
    redirect("/unauthorized?route=/maintenance/ticket-category");
  }

  const categories = await prisma.ticketCategories.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <TicketCategoryManagement role={session.role ?? "user"} initialCategories={categories} />;
}



