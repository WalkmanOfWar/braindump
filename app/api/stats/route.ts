import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const userId = session.user.id;

  // Last 30 days window
  const since30 = new Date();
  since30.setDate(since30.getDate() - 29);
  since30.setHours(0, 0, 0, 0);

  const [allTasks, recentDone, categories, exams] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      select: { done: true, priority: true, categoryId: true, createdAt: true, doneAt: true, deadline: true },
    }),
    prisma.task.findMany({
      where: { userId, done: true, doneAt: { gte: since30 } },
      select: { doneAt: true },
    }),
    prisma.category.findMany({
      where: { userId },
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.exam.findMany({
      where: { userId },
      include: { studySessions: { select: { done: true, hours: true } } },
    }),
  ]);

  // Tasks completed per day (last 30 days)
  const completedPerDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(since30);
    d.setDate(since30.getDate() + i);
    completedPerDay[d.toISOString().slice(0, 10)] = 0;
  }
  // Day-of-week breakdown (0=Mon..6=Sun) and hour-of-day (0..23)
  const dayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const hourOfDay = Array(24).fill(0) as number[];

  recentDone.forEach((t) => {
    if (!t.doneAt) return;
    const dt = new Date(t.doneAt);
    const key = dt.toISOString().slice(0, 10);
    if (key in completedPerDay) completedPerDay[key]++;
    // JS getDay: 0=Sun..6=Sat → convert to 0=Mon..6=Sun
    const dow = (dt.getDay() + 6) % 7;
    dayOfWeek[dow]++;
    hourOfDay[dt.getHours()]++;
  });

  const DOW_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
  const dayOfWeekDist = dayOfWeek.map((count, i) => ({ day: DOW_LABELS[i], count }));
  const hourOfDayDist = hourOfDay.map((count, hour) => ({ hour, count }));

  // Priority distribution
  const priorityDist = [1, 2, 3, 4, 5].map((p) => ({
    priority: p,
    count: allTasks.filter((t) => t.priority === p).length,
  }));

  // Category breakdown
  const categoryBreakdown = categories.map((c) => ({
    name: c.name,
    color: c.color,
    total: c._count.tasks,
    done: allTasks.filter((t) => t.categoryId === c.id && t.done).length,
  }));

  // Overdue tasks count
  const now = new Date();
  const overdueCount = allTasks.filter(
    (t) => !t.done && t.deadline && new Date(t.deadline) < now
  ).length;

  // Study hours this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  // Completion streak (consecutive days with at least one task done)
  const doneKeys = new Set(
    recentDone.map((t) => t.doneAt ? new Date(t.doneAt).toISOString().slice(0, 10) : "")
  );
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (doneKeys.has(key)) streak++;
    else break;
  }

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.done).length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalStudyHours = exams.flatMap((e) => e.studySessions).reduce(
    (sum, s) => sum + (s.done ? s.hours : 0),
    0
  );

  // Best day & best hour (for highlights)
  const bestDayIdx = dayOfWeek.indexOf(Math.max(...dayOfWeek));
  const bestHourIdx = hourOfDay.indexOf(Math.max(...hourOfDay));
  const totalDone30 = recentDone.length;

  return NextResponse.json({
    totalTasks,
    doneTasks,
    completionRate,
    overdueCount,
    streak,
    totalStudyHours: Math.round(totalStudyHours * 10) / 10,
    completedPerDay: Object.entries(completedPerDay).map(([date, count]) => ({ date, count })),
    priorityDist,
    categoryBreakdown,
    dayOfWeekDist,
    hourOfDayDist,
    bestDay: totalDone30 > 0 ? DOW_LABELS[bestDayIdx] : null,
    bestHour: totalDone30 > 0 ? bestHourIdx : null,
    avgPerDay: Math.round((totalDone30 / 30) * 10) / 10,
  });
}
