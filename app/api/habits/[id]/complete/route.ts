import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CompleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id: habitId } = await params;

  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: auth.user.id } });
  if (!habit) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const parsed = CompleteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowa data" }, { status: 400 });

  const { date } = parsed.data;

  const existing = await prisma.habitCompletion.findUnique({
    where: { habitId_date: { habitId, date } },
  });

  if (existing) {
    await prisma.habitCompletion.delete({ where: { id: existing.id } });
    return NextResponse.json({ completed: false });
  }

  await prisma.habitCompletion.create({ data: { habitId, date } });
  return NextResponse.json({ completed: true });
}
