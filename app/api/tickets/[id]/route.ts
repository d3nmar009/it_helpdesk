import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { ticketUpdateSchema } from "@/lib/formValidationSchemas";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const where: any = { id, isDeleted: false };
  if (!isPrivilegedRole(session.role)) {
    where.createdById = session.userId;
  }

  const ticket = await prisma.ticket.findFirst({
    where,
    select: {
      id: true,
      ticketNo: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      attachments: { select: { id: true, fileName: true, filePath: true, mimeType: true, uploadedAt: true } },
      logs: {
        select: {
          id: true,
          action: true,
          remarks: true,
          performedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const commentRows = await prisma.$queryRaw<Array<{ id: string; userId: string; comment: string; createdAt: Date }>>(
    Prisma.sql`
      SELECT id, user_id as userId, comment, created_at as createdAt
      FROM ticket_comments
      WHERE ticket_id = ${id}
      ORDER BY created_at DESC
    `,
  );
  const userIds = Array.from(new Set(commentRows.map((r) => r.userId).filter(Boolean)));
  const users = userIds.length
    ? await prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return NextResponse.json({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    attachments: ticket.attachments.map((a) => ({ ...a, uploadedAt: a.uploadedAt.toISOString() })),
    comments: commentRows.map((c) => ({
      id: c.id,
      comment: c.comment,
      createdAt: new Date(c.createdAt).toISOString(),
      user: { id: c.userId, name: userMap.get(c.userId) ?? "Unknown user" },
    })),
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contentType = req.headers.get("content-type") ?? "";

  let parsedData: {
    title: string;
    description: string;
    categoryId: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: "PENDING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED";
    createdById?: string;
  };
  let files: File[] = [];
  let removeAttachmentIds: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const raw = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      categoryId: String(form.get("categoryId") ?? ""),
      priority: String(form.get("priority") ?? ""),
      status: String(form.get("status") ?? ""),
      createdById: form.get("createdById") ? String(form.get("createdById")) : undefined,
    };

    const parsed = ticketUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    parsedData = parsed.data;

    const rawFiles = form.getAll("attachments").filter(Boolean) as unknown[];
    files = rawFiles.filter((v): v is File => typeof v === "object" && v instanceof File);

    const removeRaw = form.get("removeAttachmentIds");
    if (removeRaw) {
      try {
        const parsedIds = JSON.parse(String(removeRaw));
        if (Array.isArray(parsedIds)) {
          removeAttachmentIds = parsedIds.filter((x) => typeof x === "string") as string[];
        }
      } catch {
        // ignore
      }
    }
  } else {
    const body = await req.json().catch(() => null);
    const parsed = ticketUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    parsedData = parsed.data;
  }

  try {
    if (files.length > 2) {
      return NextResponse.json({ error: "Maximum of 2 images allowed." }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (files.length) {
      await mkdir(uploadDir, { recursive: true });
    }

    const result = await prisma.$transaction(async (tx) => {
      // enforce max 2 combined after removals
      if (contentType.includes("multipart/form-data")) {
        const remainingExisting = await tx.attachment.count({
          where: {
            ticketId: id,
            ...(removeAttachmentIds.length ? { id: { notIn: removeAttachmentIds } } : {}),
          },
        });
        if (remainingExisting + files.length > 2) {
          throw new Error("Maximum of 2 images allowed.");
        }
      }

      let removedPaths: string[] = [];
      if (contentType.includes("multipart/form-data") && removeAttachmentIds.length) {
        const toRemove = await tx.attachment.findMany({
          where: { ticketId: id, id: { in: removeAttachmentIds } },
          select: { filePath: true },
        });
        removedPaths = toRemove.map((a) => a.filePath);
        await tx.attachment.deleteMany({ where: { ticketId: id, id: { in: removeAttachmentIds } } });
      }

      const updated = await tx.ticket.update({
        where: { id },
        data: {
          title: parsedData.title,
          description: parsedData.description,
          categoryId: parsedData.categoryId,
          priority: parsedData.priority,
          status: parsedData.status,
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

      if (contentType.includes("multipart/form-data") && files.length) {
        const attachmentRows = [];
        for (const f of files) {
          if (!f.type?.startsWith("image/")) {
            throw new Error("Only image attachments are allowed.");
          }
          const ext = path.extname(f.name || "").slice(0, 10) || ".png";
          const safeExt = ext.match(/^\.[a-zA-Z0-9]+$/) ? ext : ".png";
          const filename = `${crypto.randomUUID()}${safeExt}`;
          const diskPath = path.join(uploadDir, filename);
          const buf = Buffer.from(await f.arrayBuffer());
          await writeFile(diskPath, buf);
          attachmentRows.push({
            ticketId: id,
            fileName: f.name || filename,
            filePath: `/uploads/${filename}`,
            mimeType: f.type || "image/png",
          });
        }
        if (attachmentRows.length) {
          await tx.attachment.createMany({ data: attachmentRows });
        }
      }

      return { updated, removedPaths };
    });

    // best-effort cleanup of deleted files on disk
    if (contentType.includes("multipart/form-data") && result.removedPaths.length) {
      await Promise.all(
        result.removedPaths.map(async (p) => {
          try {
            if (!p.startsWith("/uploads/")) return;
            const diskPath = path.join(process.cwd(), "public", p);
            await unlink(diskPath);
          } catch {
            // ignore
          }
        }),
      );
    }

    return NextResponse.json({
      ...result.updated,
      createdAt: result.updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("PUT /api/tickets/[id] failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to update ticket";
    const status = msg.includes("Only image") || msg.includes("Maximum of 2") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    await prisma.ticket.update({
      where: { id },
      data: { isDeleted: true },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tickets/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}


