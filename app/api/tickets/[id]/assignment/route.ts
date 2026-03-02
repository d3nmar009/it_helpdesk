import { NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

function makeTicketNo() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000); // UTC+8
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const ts = `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
  return `IT-${ts}`;
}

const remarksSchema = z.string().max(1000).optional();
const logActionSchema = z.string().max(120).optional();
const actionAtSchema = z.string().datetime().optional();
const assignmentSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("IN_PROGRESS"), actionAt: actionAtSchema, remarks: remarksSchema, logAction: logActionSchema }),
  z.object({ action: z.literal("RESOLVED"), actionAt: actionAtSchema, remarks: remarksSchema, logAction: logActionSchema }),
  z.object({
    action: z.literal("FORWARDED"),
    actionAt: actionAtSchema,
    forwardToId: z.string().uuid(),
    remarks: remarksSchema,
    logAction: logActionSchema,
  }),
]);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrivilegedRole(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      ticketNo: true,
      title: true,
      description: true,
      categoryId: true,
      priority: true,
      status: true,
      createdById: true,
      assignedToId: true,
      approvedById: true,
      approvedAt: true,
      acceptedAt: true,
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.assignedToId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const at = parsed.data.actionAt ? new Date(parsed.data.actionAt) : now;
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid actionAt date/time" }, { status: 400 });
  }

  // Workflow rules:
  // - APPROVED -> IN_PROGRESS (sets acceptedAt)
  // - IN_PROGRESS -> RESOLVED (sets resolvedAt)
  // - IN_PROGRESS -> FORWARDED (creates new ticket assigned to selected staff; closes current ticket; sets forwardedAt/closedAt)
  try {
    if (parsed.data.action === "IN_PROGRESS") {
      if (ticket.status !== "APPROVED") {
        return NextResponse.json({ error: "Only APPROVED tickets can be accepted (IN_PROGRESS)." }, { status: 400 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          acceptedAt: ticket.acceptedAt ?? at,
          // safety: ensure approvedAt exists if it was missing
          approvedAt: ticket.approvedAt ?? at,
        },
        select: { id: true, ticketNo: true, status: true },
      });

      return NextResponse.json({ ...updated });
    }

    if (parsed.data.action === "RESOLVED") {
      if (ticket.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "Only IN_PROGRESS tickets can be set to RESOLVED." }, { status: 400 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const t = await tx.ticket.update({
          where: { id },
          data: {
            status: "RESOLVED",
            resolvedAt: at,
          },
          select: { id: true, ticketNo: true, status: true },
        });

        // Insert into ticket_logs
        await tx.ticketLog.create({
          data: {
            ticketId: id,
            action: parsed.data.logAction?.trim() || null,
            remarks: parsed.data.remarks?.trim() || null,
            performedById: session.userId,
          },
          select: { id: true },
        });

        return t;
      });

      return NextResponse.json({ ...updated });
    }

    // FORWARDED
    if (ticket.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Only IN_PROGRESS tickets can be forwarded." }, { status: 400 });
    }

    if (parsed.data.forwardToId === session.userId) {
      return NextResponse.json({ error: "You cannot forward a ticket to yourself." }, { status: 400 });
    }

    const forwardTo = await prisma.users.findFirst({
      where: {
        id: parsed.data.forwardToId,
        isActive: true,
        role: { OR: [{ name: "IT_STAFF" }, { name: "ADMIN" }] },
      },
      select: { id: true, name: true },
    });
    if (!forwardTo) {
      return NextResponse.json({ error: "Forward-to user not found or not IT staff." }, { status: 400 });
    }

    const newTicket = await prisma.ticket.create({
      data: {
        ticketNo: makeTicketNo(),
        title: ticket.title,
        description: ticket.description,
        categoryId: ticket.categoryId,
        priority: ticket.priority,
        status: "APPROVED",
        createdById: ticket.createdById,
        assignedToId: forwardTo.id,
        approvedById: ticket.approvedById,
        approvedAt: ticket.approvedAt ?? at,
      },
      select: { id: true, ticketNo: true, status: true, assignedToId: true },
    });

    // Notify the forwarded-to IT staff
    await prisma.notification.create({
      data: {
        userId: forwardTo.id,
        ticketId: newTicket.id,
        message: `A ticket was forwarded to you: ${newTicket.ticketNo} — ${ticket.title}`,
      },
    });

    await prisma.ticket.update({
      where: { id },
      data: {
        status: "CLOSED",
        forwardedAt: at,
        closedAt: at,
      },
      select: { id: true },
    });

    return NextResponse.json({
      forwarded: true,
      fromTicketNo: ticket.ticketNo,
      newTicket,
    });
  } catch (err) {
    console.error("PUT /api/tickets/[id]/assignment failed:", err);
    return NextResponse.json({ error: "Failed to update ticket assignment" }, { status: 500 });
  }
}


