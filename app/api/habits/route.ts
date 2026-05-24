import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HabitCreateSchema } from "@/lib/schemas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, archivedAt: null },
    include: {
      completions: {
        // Last 84 days for heatmap (12 weeks)
        where: {
          date: { gte: (() => {
            const d = new Date();
            d.setDate(d.getDate() - 83);
            return d.toLocaleDateString("sv-SE");
          })() },
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(habits);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const parsed = HabitCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const habit = await prisma.habit.create({
    data: { ...parsed.data, userId: session.user.id },
    include: { completions: true },
  });

  return NextResponse.json(habit, { status: 201 });
}
