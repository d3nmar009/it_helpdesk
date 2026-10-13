import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";

export const runtime = "nodejs";

export async function GET() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const users = await prisma.users.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });
    return NextResponse.json(
      users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    console.error("GET /api/users failed:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}


