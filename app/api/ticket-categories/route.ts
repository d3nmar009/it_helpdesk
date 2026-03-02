import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { ticketCategorySchema } from "@/lib/formValidationSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(role: string | undefined) {
  return (role ?? "").toUpperCase() === "ADMIN";
}

export async function GET() {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const categories = await prisma.ticketCategories.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = ticketCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();

  try {
    const exists = await prisma.ticketCategories.findFirst({ where: { name } });
    if (exists) return NextResponse.json({ error: "Category name already exists" }, { status: 409 });

    const created = await prisma.ticketCategories.create({
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json(created);
  } catch (err) {
    console.error("POST /api/ticket-categories failed:", err);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}



