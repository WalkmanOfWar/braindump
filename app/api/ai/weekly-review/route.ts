import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWeeklyReview } from "@/lib/claude";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza API Anthropic" }, { status: 503 });
  }

  const userId = session.user.id;
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [completedTasksRaw, missedTasksRaw, completedSessionsRaw, activeTasksRaw] =
    await Promise.all([
      // Tasks completed in the last 7 days
      prisma.task.findMany({
        where: { userId, done: true, doneAt: { gte: weekAgo } },
        select: { title: true, doneAt: true },
        orderBy: { doneAt: "desc" },
      }),
      // Tasks with a deadline in the past 7 days that are still not done
      prisma.task.findMany({
        where: { userId, done: false, deadline: { gte: weekAgo, lte: now } },
        select: { title: true, deadline: true },
        orderBy: { deadline: "asc" },
      }),
      // Study sessions completed in the last 7 days
      prisma.studySession.findMany({
        where: {
          done: true,
          date: { gte: weekAgo },
          exam: { userId },
        },
        select: { topic: true, hours: true, exam: { select: { title: true } } },
      }),
      // All active tasks
      prisma.task.findMany({
        where: { userId, done: false },
        select: { title: true, deadline: true, priority: true },
        orderBy: [{ priority: "desc" }, { deadline: "asc" }],
        take: 15,
      }),
    ]);

  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("pl-PL") : "brak";

  const context = {
    weekStart: weekAgo.toLocaleDateString("pl-PL"),
    weekEnd: now.toLocaleDateString("pl-PL"),
    completedTasks: completedTasksRaw.map((t) => ({
      title: t.title,
      doneAt: fmt(t.doneAt),
    })),
    missedTasks: missedTasksRaw.map((t) => ({
      title: t.title,
      deadline: fmt(t.deadline),
    })),
    completedSessions: completedSessionsRaw.map((s) => ({
      topic: s.topic,
      examTitle: s.exam.title,
      hours: s.hours,
    })),
    activeTasks: activeTasksRaw.map((t) => ({
      title: t.title,
      deadline: t.deadline ? fmt(t.deadline) : undefined,
      priority: t.priority,
    })),
  };

  try {
    const review = await generateWeeklyReview(context);
    return NextResponse.json({
      review,
      stats: {
        completed: completedTasksRaw.length,
        missed: missedTasksRaw.length,
        sessions: completedSessionsRaw.length,
        studyHours: completedSessionsRaw.reduce((s, r) => s + r.hours, 0),
        active: activeTasksRaw.length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Błąd generowania podsumowania" }, { status: 500 });
  }
}
