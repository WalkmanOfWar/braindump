import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const HabitCreateSchema = z.object({
  title: z.string().min(1, "Nazwa jest wymagana").max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().default("✅"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  frequency: z.string().default("daily"),
});

// Return habits with completions for the last 35 days (5 complete weeks for the grid)
const HISTORY_DAYS = 35;

export async function GET() {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const from = new Date();
  from.setDate(from.getDate() - HISTORY_DAYS);
  const fromStr = from.toLocaleDateString("sv-SE");

  const habits = await prisma.habit.findMany({
    where: { userId: auth.user.id, archivedAt: null },
    include: {
      completions: {
        where: { date: { gte: fromStr } },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(habits);
}

export async function POST(req: NextRequest) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const parsed = HabitCreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });

  const habit = await prisma.habit.create({
    data: { ...parsed.data, userId: auth.user.id },
    include: { completions: true },
  });

  return NextResponse.json(habit, { status: 201 });
}
