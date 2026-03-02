import { prisma } from "@/lib/prisma";
import UserMaintenance from "./user-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/routeAccess";
import { SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";

export default async function MaintenanceUsersPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) redirect("/sign-in");
  if (!canAccessRoute("/maintenance/users", session.role)) redirect("/unauthorized?route=/maintenance/users");

  const roles = await prisma.role.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const users = await prisma.users.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      isActive: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
    },
  });

  return (
    <UserMaintenance
      role={session.role ?? "user"}
      roles={roles}
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
    />
  );
}


