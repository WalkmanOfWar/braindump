import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findFirst({ where: { id, userId: session.user.id } });
  if (!habit) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const { date } = await req.json() as { date: string }; // YYYY-MM-DD

  // Toggle: if already done today — remove; otherwise create
  const existing = await prisma.habitCompletion.findUnique({
    where: { habitId_date: { habitId: id, date } },
  });

  if (existing) {
    await prisma.habitCompletion.delete({ where: { habitId_date: { habitId: id, date } } });
    return NextResponse.json({ done: false });
  }

  await prisma.habitCompletion.create({ data: { habitId: id, date } });
  return NextResponse.json({ done: true });
}
