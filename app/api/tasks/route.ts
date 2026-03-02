import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { getAllActiveStaffUnderBossIds } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const statusSchema = z.enum(["pending", "accepted", "completed", "cancelled"]);

function parseYmd(s: string) {
  // YYYY-MM-DD (interpreted as UTC date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "all") as "all" | "own" | "staff";
  const assignedToIdParam = url.searchParams.get("assignedToId") ?? undefined;
  const fromParam = url.searchParams.get("from") ?? undefined;
  const toParam = url.searchParams.get("to") ?? undefined;
  const priorityParam = url.searchParams.get("priority") ?? undefined;
  const statusParam = url.searchParams.get("status") ?? undefined;

  // Allowed assignees: self OR any staff under me (direct + indirect).
  const staffIds = await getAllActiveStaffUnderBossIds(session.userId);
  const allowed = new Set<string>([session.userId, ...staffIds]);

  let priorityFilter: z.infer<typeof prioritySchema> | undefined;
  if (priorityParam && priorityParam !== "__ALL__") {
    const parsed = prioritySchema.safeParse(priorityParam);
    if (!parsed.success) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    priorityFilter = parsed.data;
  }
  let statusFilter: z.infer<typeof statusSchema> | undefined;
  if (statusParam && statusParam !== "__ALL__") {
    const parsed = statusSchema.safeParse(statusParam);
    if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    statusFilter = parsed.data;
  }

  const createdAtFilter: { gte?: Date; lt?: Date } = {};
  if (fromParam) {
    const from = parseYmd(fromParam);
    if (!from) return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
    createdAtFilter.gte = from;
  }
  if (toParam) {
    const to = parseYmd(toParam);
    if (!to) return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
    // make end inclusive by using < next day
    createdAtFilter.lt = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }

  const where: any = { isDeleted: false };

  if (scope === "own") {
    where.assignedToId = session.userId;
  } else if (scope === "staff") {
    if (!assignedToIdParam) {
      return NextResponse.json({ error: "assignedToId is required for staff scope" }, { status: 400 });
    }
    if (!allowed.has(assignedToIdParam) || assignedToIdParam === session.userId) {
      return NextResponse.json({ error: "Invalid staff selection" }, { status: 400 });
    }
    where.createdById = session.userId;
    where.assignedToId = assignedToIdParam;
  } else {
    // all: tasks I created or tasks assigned to me
    where.OR = [{ createdById: session.userId }, { assignedToId: session.userId }];
    if (assignedToIdParam) {
      if (!allowed.has(assignedToIdParam)) {
        return NextResponse.json({ error: "Invalid assignedToId" }, { status: 400 });
      }
      where.assignedToId = assignedToIdParam;
    }
  }

  if (createdAtFilter.gte || createdAtFilter.lt) {
    where.createdAt = createdAtFilter;
  }
  if (priorityFilter) where.priority = priorityFilter;
  if (statusFilter) where.status = statusFilter;

  const rows = await prisma.task.findMany({
    where,
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

  return NextResponse.json(
    rows.map((t) => ({
      ...t,
      description: t.description ?? "",
      status: statusSchema.parse(t.status),
      priority: prioritySchema.parse(t.priority),
      createdAt: t.createdAt.toISOString(),
    })),
  );
}

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  assignedToId: z.string().uuid().optional(),
  priority: prioritySchema.optional(),
  createdAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const createdAt = parsed.data.createdAt ? new Date(parsed.data.createdAt) : new Date();
  if (Number.isNaN(createdAt.getTime())) {
    return NextResponse.json({ error: "Invalid createdAt" }, { status: 400 });
  }

  // Allowed assignees: self OR any staff under me (direct + indirect).
  const staffIds = await getAllActiveStaffUnderBossIds(session.userId);
  const allowed = new Set<string>([session.userId, ...staffIds]);

  const assignedToId = parsed.data.assignedToId ?? session.userId;
  if (!allowed.has(assignedToId)) {
    return NextResponse.json({ error: "You can only assign tasks to yourself or your staff." }, { status: 400 });
  }

  const created = await prisma.task.create({
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      status: "pending",
      priority: parsed.data.priority ?? "medium",
      createdAt,
      createdById: session.userId,
      assignedToId,
    },
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

  return NextResponse.json({
    ...created,
    description: created.description ?? "",
    createdAt: created.createdAt.toISOString(),
  });
}

