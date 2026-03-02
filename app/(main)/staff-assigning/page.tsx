import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import StaffAssigningManagement from "./StaffAssigningManagement";

export default async function StaffAssigningPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    redirect("/sign-in");
  }

  // Employees available to add: active users that currently have no manager.
  const employees = await prisma.users.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      department: { select: { id: true, name: true } },
      role: { select: { name: true } },
      reportsToId: true,
      reportsTo: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const myStaff = await prisma.users.findMany({
    where: {
      isActive: true,
      reportsToId: session.userId,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      department: { select: { id: true, name: true } },
      role: { select: { name: true } },
      reportsToId: true,
      reportsTo: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <StaffAssigningManagement
      currentUserId={session.userId}
      employeeOptions={employees.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        department: u.department ? { id: u.department.id, name: u.department.name } : null,
        role: u.role?.name ?? null,
        reportsToId: u.reportsToId,
        boss: u.reportsTo ? { id: u.reportsTo.id, name: u.reportsTo.name } : null,
      }))}
      initialMyStaff={myStaff.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        department: u.department ? { id: u.department.id, name: u.department.name } : null,
        role: u.role?.name ?? null,
        reportsToId: u.reportsToId,
        boss: u.reportsTo ? { id: u.reportsTo.id, name: u.reportsTo.name } : null,
      }))}
    />
  );
}

