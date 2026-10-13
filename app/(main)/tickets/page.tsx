import { prisma } from "@/lib/prisma";
import TicketManagement from "./ticket-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";

export default async function TicketPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) redirect("/sign-in");
  const categories = await prisma.ticketCategories.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const isPrivileged = (session.role ?? "").toUpperCase() === "ADMIN" || (session.role ?? "").toUpperCase() === "IT_STAFF";
  const users = isPrivileged
    ? await prisma.users.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const whereClause =
    session.role === "ADMIN"
      ? { isDeleted: false }
      : { isDeleted: false, createdById: session.userId };
  const initialTickets = await prisma.ticket.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ticketNo: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return (
    <TicketManagement
      role={session.role ?? "user"}
      currentUserId={session.userId ?? ""}
      users={users}
      categories={categories}
      initialTickets={initialTickets.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
    />
  );
}


