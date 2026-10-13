import { prisma } from "@/lib/prisma";
import TicketTriageManagement from "./ticket-triage-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";
import { canAccessRoute } from "@/lib/routeAccess";
import { Prisma } from "@/generated/prisma/client";

export default async function TicketManagementPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) redirect("/sign-in");
  if (!canAccessRoute("/ticket-management", session.role)) redirect("/unauthorized?route=/ticket-management");

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
      logs: { take: 1, select: { action: true, remarks: true } },
    },
  });

  const ticketIds = initialTickets.map((t) => t.id);
  const commentCounts = ticketIds.length
    ? await prisma.$queryRaw<Array<{ ticketId: string; cnt: bigint | number }>>(Prisma.sql`
        SELECT ticket_id as ticketId, COUNT(*) as cnt
        FROM ticket_comments
        WHERE ticket_id IN (${Prisma.join(ticketIds)})
        GROUP BY ticket_id
      `)
    : [];
  const commentCountMap = new Map<string, number>(
    commentCounts.map((r) => [r.ticketId, typeof r.cnt === "bigint" ? Number(r.cnt) : Number(r.cnt)]),
  );

  return (
    <TicketTriageManagement
      currentUserId={session.userId ?? ""}
      role={session.role ?? "user"}
      itStaffUsers={itStaffUsers}
      initialTickets={initialTickets.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        createdBy: { id: t.createdBy.id, name: t.createdBy.name, department: t.createdBy.department ?? { id: "", name: "" } },
        attachmentCount: (t as any)._count?.attachments ?? 0,
        action: (t as any).logs?.[0]?.action ?? null,
        remarks: (t as any).logs?.[0]?.remarks ?? null,
        commentCount: commentCountMap.get(t.id) ?? 0,
      }))}
    />
  );
}


