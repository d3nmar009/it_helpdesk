import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, commentId } = await ctx.params;

  // Must be able to view the ticket to manage comments.
  const where: any = { id, isDeleted: false };
  if (!isPrivilegedRole(session.role)) {
    where.createdById = session.userId;
  }
  const ticket = await prisma.ticket.findFirst({ where, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.$queryRaw<Array<{ userId: string }>>(
    Prisma.sql`
      SELECT user_id as userId
      FROM ticket_comments
      WHERE id = ${commentId} AND ticket_id = ${id}
      LIMIT 1
    `,
  );
  const authorId = rows[0]?.userId;
  if (!authorId) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  const canDelete = isPrivilegedRole(session.role) || authorId === session.userId;
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM ticket_comments
      WHERE id = ${commentId} AND ticket_id = ${id}
    `,
  );

  return NextResponse.json({ ok: true });
}

