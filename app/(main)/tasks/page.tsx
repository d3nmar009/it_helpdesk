import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { getAllActiveStaffUnderBoss } from "@/lib/staff";
import TaskManagement from "./TaskManagement";

export default async function TasksPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    redirect("/sign-in");
  }

  const myStaff = await getAllActiveStaffUnderBoss(session.userId);

  const initialTasks = await prisma.task.findMany({
    where: {
      isDeleted: false,
      OR: [{ createdById: session.userId }, { assignedToId: session.userId }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return (
    <TaskManagement
      currentUserId={session.userId}
      staffOptions={myStaff}
      initialTasks={initialTasks.map((t) => ({
        ...t,
        description: t.description ?? "",
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}

