import { prisma } from "@/lib/prisma";
import TicketAssignmentManagement from "./ticket-assignment-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { type SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";
import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/routeAccess";

export default async function TicketAssignmentPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) redirect("/sign-in");
  if (!canAccessRoute("/ticket-asignment", session.role)) redirect("/unauthorized?route=/ticket-asignment");
  if (!session.userId) redirect("/sign-in");

  const itStaffUsers = await prisma.users.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      role: { OR: [{ name: "IT_STAFF" }, { name: "ADMIN" }] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const initialTickets = await prisma.ticket.findMany({
    where: {
      isDeleted: false,
      assignedToId: session.userId ?? undefined,
      status: {
        notIn: ["PENDING_APPROVAL"],
      },
    },
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
      createdBy: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
      logs: { take: 1, select: { action: true, remarks: true } },
    },
  });

  return (
    <TicketAssignmentManagement
      role={session.role ?? "user"}
      itStaffUsers={itStaffUsers}
      initialTickets={initialTickets.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
    />
  );
}


