import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { ticketTriageSchema } from "@/lib/formValidationSchemas";

export const runtime = "nodejs";

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivilegedRole(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ticketTriageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const before = await prisma.ticket.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        ticketNo: true,
        title: true,
        status: true,
        createdById: true,
        assignedToId: true,
      },
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Enforce: cannot approve without assigning IT staff (specifically from PENDING_APPROVAL -> APPROVED).
    if (before.status === "PENDING_APPROVAL" && parsed.data.status === "APPROVED" && !parsed.data.assignedToId) {
      return NextResponse.json(
        { error: "Cannot approve ticket without assignment to IT Staff." },
        { status: 400 },
      );
    }

    const now = new Date();

    let approvedAtOverride: Date | undefined;
    if (parsed.data.status === "APPROVED" && parsed.data.approvedAt) {
      const d = new Date(parsed.data.approvedAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid approvedAt date" }, { status: 400 });
      }
      approvedAtOverride = d;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        priority: parsed.data.priority,
        status: parsed.data.status,
        assignedToId: parsed.data.assignedToId ?? null,
        ...(parsed.data.status === "APPROVED"
          ? { approvedAt: approvedAtOverride ?? now, rejectedAt: null }
          : parsed.data.status === "REJECTED"
            ? { rejectedAt: now, approvedAt: null }
            : parsed.data.status === "CLOSED"
              ? { closedAt: now }
            : {}),
      },
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
      },
    });

    // Notifications:
    // - if APPROVED/REJECTED changed => notify createdBy
    if (parsed.data.status !== before.status && (parsed.data.status === "APPROVED" || parsed.data.status === "REJECTED")) {
      await prisma.notification.create({
        data: {
          userId: before.createdById,
          ticketId: before.id,
          message:
            parsed.data.status === "APPROVED"
              ? `Your ticket was approved: ${before.ticketNo} — ${before.title}`
              : `Your ticket was rejected: ${before.ticketNo} — ${before.title}`,
        },
      });
    }

    // - if assignedTo changed => notify new assignee
    const nextAssignedToId = parsed.data.assignedToId ?? null;
    if (nextAssignedToId && nextAssignedToId !== before.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: nextAssignedToId,
          ticketId: before.id,
          message: `A ticket was assigned to you: ${before.ticketNo} — ${before.title}`,
        },
      });
    }

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("PUT /api/tickets/[id]/triage failed:", err);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}


