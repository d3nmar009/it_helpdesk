import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = (url.searchParams.get("unread") ?? "1") !== "0";
  const take = Math.min(Math.max(parseInt(url.searchParams.get("take") ?? "20", 10) || 20, 1), 50);

  const items = await prisma.notification.findMany({
    where: {
      userId: session.userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      message: true,
      isRead: true,
      createdAt: true,
      ticket: { select: { id: true, ticketNo: true } },
    },
  });

  return NextResponse.json(
    items.map((n) => ({
      id: n.id,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      ticket: n.ticket,
    })),
  );
}




