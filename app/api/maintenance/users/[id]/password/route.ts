import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { userPasswordResetSchema } from "@/lib/formValidationSchemas";

export const runtime = "nodejs";

function isAdmin(role: string | undefined) {
  return (role ?? "").toUpperCase() === "ADMIN";
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = userPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.users.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await prisma.users.update({ where: { id }, data: { password: hashedPassword } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/maintenance/users/[id]/password failed:", err);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
