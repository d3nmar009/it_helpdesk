import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  comment: z.string().min(1, "Comment is required").max(5000, "Comment is too long"),
});

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Must be able to view the ticket to comment.
  const where: any = { id, isDeleted: false };
  if (!isPrivilegedRole(session.role)) {
    where.createdById = session.userId;
  }
  const ticket = await prisma.ticket.findFirst({ where, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const commentId = crypto.randomUUID();
  const commentText = parsed.data.comment.trim();

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO ticket_comments (id, ticket_id, user_id, comment, created_at)
      VALUES (${commentId}, ${id}, ${session.userId}, ${commentText}, NOW())
    `,
  );

  return NextResponse.json({
    id: commentId,
    comment: commentText,
    createdAt: new Date().toISOString(),
    user: { id: session.userId, name: session.username ?? "You" },
  });
}

