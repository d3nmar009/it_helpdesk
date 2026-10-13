import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { ticketCreateSchema, ticketStatusSchema } from "@/lib/formValidationSchemas";
import { Prisma } from "@/generated/prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketListRow = {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  priority: string | null;
  status: string;
  createdAt: Date;
  category: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string; department: { id: string; name: string } | null };
  logs: { action: string | null; remarks: string | null }[];
  _count: { attachments: number };
};

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

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

export async function GET(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrivilegedRole(session.role) && !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from"); // YYYY-MM-DD
  const to = url.searchParams.get("to"); // YYYY-MM-DD
  const statusParam = url.searchParams.get("status");
  const assignedToIdParam = url.searchParams.get("assignedToId");

  let createdAt: { gte?: Date; lt?: Date } | undefined;
  if (from) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(fromDate.getTime())) createdAt = { ...(createdAt ?? {}), gte: fromDate };
  }
  if (to) {
    // exclusive end: next day 00:00:00Z
    const toDate = new Date(`${to}T00:00:00.000Z`);
    if (!Number.isNaN(toDate.getTime())) {
      const next = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
      createdAt = { ...(createdAt ?? {}), lt: next };
    }
  }

  const where: Prisma.TicketWhereInput = {};
  where.isDeleted = false;
  if (!isPrivilegedRole(session.role)) {
    where.createdById = session.userId;
  }
  if (createdAt) {
    where.createdAt = createdAt;
  }
  const parsedStatus = ticketStatusSchema.safeParse(statusParam);
  if (parsedStatus.success) {
    where.status = parsedStatus.data;
  }

  // Assigned-to filter:
  // - assignedToId=__NONE__ => only unassigned tickets
  // - assignedToId=<uuid> => only tickets assigned to that user
  if (assignedToIdParam === "__NONE__") {
    where.assignedToId = null;
  } else if (assignedToIdParam) {
    // lightweight uuid validation (avoid importing zod here)
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(assignedToIdParam)) {
      where.assignedToId = assignedToIdParam;
    }
  }

  const tickets = (await prisma.ticket.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: "desc" },
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
      createdBy: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
      logs: { take: 1, select: { action: true, remarks: true } },
      _count: { select: { attachments: true } },
    },
  })) as unknown as TicketListRow[];

  const ticketIds = tickets.map((t) => t.id);
  const commentCounts = ticketIds.length
    ? await prisma.$queryRaw<Array<{ ticketId: string; cnt: bigint | number }>>(Prisma.sql`
        SELECT ticket_id as ticketId, COUNT(*) as cnt
        FROM ticket_comments
        WHERE ticket_id IN (${Prisma.join(ticketIds)})
        GROUP BY ticket_id
      `)
    : [];
  const commentCountMap = new Map<string, number>(
    commentCounts.map((r) => [r.ticketId, typeof r.cnt === "bigint" ? Number(r.cnt) : Number(r.cnt)]),
  );

  return NextResponse.json(
    tickets.map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      category: t.category,
      assignedTo: t.assignedTo,
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString(),
      attachmentCount: t._count.attachments ?? 0,
      action: t.logs?.[0]?.action ?? null,
      remarks: t.logs?.[0]?.remarks ?? null,
      commentCount: commentCountMap.get(t.id) ?? 0,
    })),
  );
}

export async function POST(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  let parsedData: {
    title: string;
    description: string;
    categoryId: string;
    priority: Priority;
    createdById?: string;
    createdAt?: string;
  };
  let files: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const raw = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      categoryId: String(form.get("categoryId") ?? ""),
      priority: String(form.get("priority") ?? ""),
      createdById: form.get("createdById") ? String(form.get("createdById")) : undefined,
      createdAt: form.get("createdAt") ? String(form.get("createdAt")) : undefined,
    };
    const parsed = ticketCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    parsedData = parsed.data;

    const rawFiles = form.getAll("attachments").filter(Boolean) as unknown[];
    files = rawFiles.filter((v): v is File => typeof v === "object" && v instanceof File);
  } else {
    const body = await req.json().catch(() => null);
    const parsed = ticketCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    parsedData = parsed.data;
  }

  try {
    const createdById =
      isPrivilegedRole(session.role) && parsedData.createdById ? parsedData.createdById : session.userId;

    let createdAtOverride: Date | undefined;
    if (isPrivilegedRole(session.role) && parsedData.createdAt) {
      const d = new Date(parsedData.createdAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid createdAt date" }, { status: 400 });
      }
      createdAtOverride = d;
    }

    if (files.length > 2) {
      return NextResponse.json({ error: "Maximum of 2 images allowed." }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (files.length) {
      await mkdir(uploadDir, { recursive: true });
    }

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ticket = await tx.ticket.create({
        data: {
          ticketNo: makeTicketNo(),
          title: parsedData.title,
          description: parsedData.description,
          categoryId: parsedData.categoryId,
          priority: parsedData.priority,
          createdById,
          ...(createdAtOverride ? { createdAt: createdAtOverride } : {}),
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
        },
      });

      if (files.length) {
        const attachmentRows: Array<{
          ticketId: string;
          fileName: string;
          filePath: string;
          mimeType: string;
        }> = [];
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
            ticketId: ticket.id,
            fileName: f.name || filename,
            filePath: `/uploads/${filename}`,
            mimeType: f.type || "image/png",
          });
        }
        if (attachmentRows.length) {
          await tx.attachment.createMany({ data: attachmentRows });
        }
      }

      // Notify all active ADMIN/IT_STAFF about new ticket
      const staff: Array<{ id: string }> = await tx.users.findMany({
        where: {
          isActive: true,
          role: { OR: [{ name: "IT_STAFF" }, { name: "ADMIN" }] },
        },
        select: { id: true },
      });
      if (staff.length) {
        await tx.notification.createMany({
          data: staff.map((u) => ({
            userId: u.id,
            ticketId: ticket.id,
            message: `New ticket created: ${ticket.ticketNo} — ${ticket.title}`,
          })),
        });
      }

      return ticket;
    });

    return NextResponse.json({
      ...created,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("POST /api/tickets failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to create ticket";
    const status = msg.includes("Only image") || msg.includes("Maximum of 2") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}


