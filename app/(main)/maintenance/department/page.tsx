import { prisma } from "@/lib/prisma";
import DepartmentManagement from "./department-management";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { type SessionDataHelpdesk, sessionOptions } from "@/lib/sessionOption";
import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/routeAccess";

export default async function MaintenanceDepartmentPage() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) redirect("/sign-in");
  if (!canAccessRoute("/maintenance/department", session.role)) redirect("/unauthorized?route=/maintenance/department");

  const departments = await prisma.departments.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <DepartmentManagement role={session.role ?? "user"} initialDepartments={departments} />;
}


