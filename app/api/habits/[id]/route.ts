import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const HabitUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  frequency: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
});

async function getOwned(habitId: string, userId: string) {
  return prisma.habit.findFirst({ where: { id: habitId, userId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const habit = await getOwned(id, auth.user.id);
  if (!habit) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const parsed = HabitUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });

  const { archivedAt, ...rest } = parsed.data;
  const updated = await prisma.habit.update({
    where: { id },
    data: {
      ...rest,
      ...(archivedAt !== undefined ? { archivedAt: archivedAt ? new Date(archivedAt) : null } : {}),
    },
    include: { completions: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const habit = await getOwned(id, auth.user.id);
  if (!habit) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
