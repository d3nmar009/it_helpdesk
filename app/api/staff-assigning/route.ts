import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapUser(u: {
  id: string;
  name: string;
  username: string;
  email: string;
  department: { id: string; name: string } | null;
  role: { name: string } | null;
  reportsToId: string | null;
  reportsTo: { id: string; name: string } | null;
}) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    department: u.department ? { id: u.department.id, name: u.department.name } : null,
    role: u.role?.name ?? null,
    reportsToId: u.reportsToId,
    boss: u.reportsTo ? { id: u.reportsTo.id, name: u.reportsTo.name } : null,
  };
}

export async function GET() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [employees, myStaff] = await Promise.all([
    prisma.users.findMany({
      where: { isActive: true, id: { not: session.userId } },
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
    }),
    prisma.users.findMany({
      where: { isActive: true, reportsToId: session.userId },
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
    }),
  ]);

  return NextResponse.json({
    employees: employees.map(mapUser),
    myStaff: myStaff.map(mapUser),
  });
}

const addSchema = z.object({ staffId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.staffId === session.userId) {
    return NextResponse.json({ error: "You cannot add yourself." }, { status: 400 });
  }

  // Only allow assigning users that currently have no manager (reportsToId is null).
  const updated = await prisma.users.updateMany({
    where: {
      id: parsed.data.staffId,
      isActive: true,
      reportsToId: null,
    },
    data: {
      reportsToId: session.userId,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Employee not found or already assigned." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

