import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { getAllActiveStaffUnderBossIds } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const statusSchema = z.enum(["pending", "accepted", "completed", "cancelled"]);

const statusUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT"), at: z.string().datetime() }),
  z.object({ action: z.literal("COMPLETE"), at: z.string().datetime() }),
]);

function safeExtFromName(name: string) {
  const ext = path.extname(name || "").slice(0, 10) || "";
  return ext && /^\.[a-zA-Z0-9]+$/.test(ext) ? ext : "";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const task = await prisma.task.findFirst({
    where: {
      id,
      isDeleted: false,
      OR: [{ createdById: session.userId }, { assignedToId: session.userId }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      acceptedAt: true,
      completedAt: true,
      cancelledAt: true,
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      attachments: {
        select: {
          id: true,
          filePath: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        select: {
          id: true,
          comment: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: statusSchema.parse(task.status),
    priority: prioritySchema.parse(task.priority),
    createdAt: task.createdAt.toISOString(),
    acceptedAt: task.acceptedAt ? task.acceptedAt.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    cancelledAt: task.cancelledAt ? task.cancelledAt.toISOString() : null,
    assignedTo: task.assignedTo,
    createdBy: task.createdBy,
    attachments: task.attachments.map((a) => ({
      id: String(a.id), // BigInt -> string
      filePath: a.filePath,
      createdAt: a.createdAt.toISOString(),
      uploadedBy: a.uploadedBy ? { id: a.uploadedBy.id, name: a.uploadedBy.name } : null,
    })),
    comments: task.comments.map((c) => ({
      id: c.id,
      comment: c.comment,
      createdAt: c.createdAt.toISOString(),
      user: c.user ? { id: c.user.id, name: c.user.name } : null,
    })),
  });
}

const updateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  assignedToId: z.string().uuid().optional(),
  priority: prioritySchema.optional(),
  createdAt: z.string().datetime().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contentType = req.headers.get("content-type") ?? "";

  let parsedAction: z.infer<typeof statusUpdateSchema> | null = null;
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    const raw = {
      action: String(form.get("action") ?? ""),
      at: String(form.get("at") ?? ""),
    };
    const parsed = statusUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    parsedAction = parsed.data;
    const rawFiles = form.getAll("attachments").filter(Boolean) as unknown[];
    files = rawFiles.filter((v): v is File => typeof v === "object" && v instanceof File);
  } else {
    const body = await req.json().catch(() => null);
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    parsedAction = parsed.data;
  }

  const parsed = { success: true as const, data: parsedAction! };

  const before = await prisma.task.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, status: true, assignedToId: true },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (before.assignedToId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const at = new Date(parsed.data.at);
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }

  if (parsed.data.action === "ACCEPT") {
    if (before.status !== "pending") {
      return NextResponse.json({ error: "Only pending tasks can be accepted." }, { status: 400 });
    }
    const updated = await prisma.task.update({
      where: { id },
      data: { status: "accepted", acceptedAt: at },
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
      ...updated,
      description: updated.description ?? "",
      createdAt: updated.createdAt.toISOString(),
    });
  }

  // COMPLETE
  if (before.status !== "accepted") {
    return NextResponse.json({ error: "Only accepted tasks can be completed." }, { status: 400 });
  }

  if (contentType.includes("multipart/form-data") && files.length > 10) {
    return NextResponse.json({ error: "Maximum of 10 attachments allowed." }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (contentType.includes("multipart/form-data") && files.length) {
    await mkdir(uploadDir, { recursive: true });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.task.update({
      where: { id },
      data: { status: "completed", completedAt: at },
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

    if (contentType.includes("multipart/form-data") && files.length) {
      const attachmentRows: { taskId: string; uploadedById: string; filePath: string }[] = [];
      for (const f of files) {
        const ext = safeExtFromName(f.name);
        const filename = `${crypto.randomUUID()}${ext}`;
        const diskPath = path.join(uploadDir, filename);
        const buf = Buffer.from(await f.arrayBuffer());
        await writeFile(diskPath, buf);
        attachmentRows.push({
          taskId: id,
          uploadedById: session.userId!,
          filePath: `/uploads/${filename}`,
        });
      }
      if (attachmentRows.length) {
        await tx.taskAttachment.createMany({ data: attachmentRows });
      }
    }

    return t;
  });
  return NextResponse.json({
    ...updated,
    description: updated.description ?? "",
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const before = await prisma.task.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, createdById: true, status: true },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (before.createdById !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (before.status !== "pending") {
    return NextResponse.json({ error: "Only pending tasks can be updated." }, { status: 400 });
  }

  const staffIds = await getAllActiveStaffUnderBossIds(session.userId);
  const allowed = new Set<string>([session.userId, ...staffIds]);

  const assignedToId = parsed.data.assignedToId ?? undefined;
  if (assignedToId && !allowed.has(assignedToId)) {
    return NextResponse.json({ error: "You can only assign tasks to yourself or your staff." }, { status: 400 });
  }

  const createdAt = parsed.data.createdAt ? new Date(parsed.data.createdAt) : undefined;
  if (createdAt && Number.isNaN(createdAt.getTime())) {
    return NextResponse.json({ error: "Invalid createdAt" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      priority: parsed.data.priority ?? undefined,
      assignedToId: assignedToId ?? undefined,
      createdAt: createdAt ?? undefined,
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
    ...updated,
    description: updated.description ?? "",
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const updated = await prisma.task.updateMany({
    where: { id, createdById: session.userId, isDeleted: false },
    data: { isDeleted: true },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

