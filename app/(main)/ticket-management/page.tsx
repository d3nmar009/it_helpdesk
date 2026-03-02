import { prisma } from "@/lib/prisma";
import TicketTriageManagement from "./ticket-triage-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";

export default async function TicketManagementPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);

  const itStaffUsers = await prisma.users.findMany({
    where: {
      isActive: true,
      role: {
        OR: [ { name: "IT_STAFF" }, { name: "ADMIN" } ],
      },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const initialTickets = await prisma.ticket.findMany({
    where: { isDeleted: false, status: { not: "CLOSED" } },
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
      _count: { select: { attachments: true } },
    },
  });

  return (
    <TicketTriageManagement
      role={session.role ?? "user"}
      itStaffUsers={itStaffUsers}
      initialTickets={initialTickets.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        createdBy: { id: t.createdBy.id, name: t.createdBy.name, department: t.createdBy.department ?? { id: "", name: "" } },
        attachmentCount: (t as any)._count?.attachments ?? 0,
      }))}
    />
  );
}


