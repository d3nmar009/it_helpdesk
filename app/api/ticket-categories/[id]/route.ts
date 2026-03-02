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

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ticketCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();

  try {
    const conflict = await prisma.ticketCategories.findFirst({
      where: { name, NOT: { id } },
      select: { id: true },
    });
    if (conflict) return NextResponse.json({ error: "Category name already exists" }, { status: 409 });

    const updated = await prisma.ticketCategories.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/ticket-categories/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await prisma.ticketCategories.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/ticket-categories/[id] failed:", err);
    return NextResponse.json(
      { error: "Failed to delete category. It may be in use by existing tickets." },
      { status: 500 },
    );
  }
}



