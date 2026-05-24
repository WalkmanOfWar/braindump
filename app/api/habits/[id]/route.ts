import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HabitCreateSchema } from "@/lib/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findFirst({ where: { id, userId: session.user.id } });
  if (!habit) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const parsed = HabitCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const updated = await prisma.habit.update({
    where: { id },
    data: parsed.data,
    include: { completions: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findFirst({ where: { id, userId: session.user.id } });
  if (!habit) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  // Soft-delete to preserve history
  await prisma.habit.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
