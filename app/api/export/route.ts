import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const userId = session.user.id;

  const [tasks, exams, categories, habits, goals] = await Promise.all([
    prisma.task.findMany({ where: { userId } }),
    prisma.exam.findMany({ where: { userId }, include: { studySessions: true } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.habit.findMany({ where: { userId }, include: { completions: true } }),
    prisma.goal.findMany({ where: { userId }, include: { tasks: { select: { id: true } } } }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    user: {
      id: userId,
      email: session.user.email,
      name: session.user.name,
    },
    tasks,
    exams,
    categories,
    habits,
    goals,
    meta: {
      counts: {
        tasks: tasks.length,
        exams: exams.length,
        categories: categories.length,
        habits: habits.length,
        goals: goals.length,
      },
    },
  };

  const filename = `brain-dump-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
