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
  const since30Str = since30.toLocaleDateString("sv-SE");

  const [allTasks, recentDone, categories, exams, planningTasks, energyCheckIns] = await Promise.all([
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
    // Planning Fallacy: tasks with both estimated and actual minutes
    prisma.task.findMany({
      where: { userId, done: true, estimatedMinutes: { not: null }, actualMinutes: { not: null } },
      select: { estimatedMinutes: true, actualMinutes: true, categoryId: true },
    }),
    // Energy trend
    prisma.energyCheckIn.findMany({
      where: { userId, date: { gte: since30Str } },
      select: { date: true, level: true },
    }),
  ]);

  // ── Tasks completed per day (last 30 days) ────────────────────────────────
  const completedPerDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(since30);
    d.setDate(since30.getDate() + i);
    completedPerDay[d.toISOString().slice(0, 10)] = 0;
  }
  const dayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const hourOfDay = Array(24).fill(0) as number[];

  recentDone.forEach((t) => {
    if (!t.doneAt) return;
    const dt = new Date(t.doneAt);
    const key = dt.toISOString().slice(0, 10);
    if (key in completedPerDay) completedPerDay[key]++;
    const dow = (dt.getDay() + 6) % 7;
    dayOfWeek[dow]++;
    hourOfDay[dt.getHours()]++;
  });

  const DOW_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];
  const dayOfWeekDist = dayOfWeek.map((count, i) => ({ day: DOW_LABELS[i], count }));
  const hourOfDayDist = hourOfDay.map((count, hour) => ({ hour, count }));

  // ── Priority distribution ─────────────────────────────────────────────────
  const priorityDist = [1, 2, 3, 4, 5].map((p) => ({
    priority: p,
    count: allTasks.filter((t) => t.priority === p).length,
  }));

  // ── Category breakdown ────────────────────────────────────────────────────
  const categoryBreakdown = categories.map((c) => ({
    name: c.name,
    color: c.color,
    total: c._count.tasks,
    done: allTasks.filter((t) => t.categoryId === c.id && t.done).length,
  }));

  const now = new Date();
  const overdueCount = allTasks.filter(
    (t) => !t.done && t.deadline && new Date(t.deadline) < now
  ).length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  // ── Streak ────────────────────────────────────────────────────────────────
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
    (sum, s) => sum + (s.done ? s.hours : 0), 0
  );

  const bestDayIdx = dayOfWeek.indexOf(Math.max(...dayOfWeek));
  const bestHourIdx = hourOfDay.indexOf(Math.max(...hourOfDay));
  const totalDone30 = recentDone.length;

  // ── 5.1 Planning Fallacy ──────────────────────────────────────────────────
  // Per-category: total estimated vs actual minutes (only tasks with both values)
  const catMap = new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }]));

  type CatPlan = { name: string; color: string; estimatedMin: number; actualMin: number; count: number };
  const planningByCat = new Map<string, CatPlan>();

  planningTasks.forEach((t) => {
    const catId = t.categoryId ?? "__none__";
    const catInfo = catId !== "__none__" ? catMap.get(catId) : undefined;
    const name = catInfo?.name ?? "Bez kategorii";
    const color = catInfo?.color ?? "#888888";
    const existing = planningByCat.get(catId) ?? { name, color, estimatedMin: 0, actualMin: 0, count: 0 };
    planningByCat.set(catId, {
      ...existing,
      estimatedMin: existing.estimatedMin + (t.estimatedMinutes ?? 0),
      actualMin: existing.actualMin + (t.actualMinutes ?? 0),
      count: existing.count + 1,
    });
  });

  const planningByCategory = Array.from(planningByCat.values()).sort((a, b) => b.count - a.count);

  // Deviation histogram: (actual - estimated) / estimated → buckets
  type DevBucket = { label: string; count: number };
  const bucketDefs: { label: string; min: number; max: number }[] = [
    { label: "≤ -50%", min: -Infinity, max: -0.5 },
    { label: "-50 do -20%", min: -0.5, max: -0.2 },
    { label: "-20 do 0%", min: -0.2, max: 0 },
    { label: "0 do +20%", min: 0, max: 0.2 },
    { label: "+20 do +50%", min: 0.2, max: 0.5 },
    { label: "> +50%", min: 0.5, max: Infinity },
  ];
  const deviationHistogram: DevBucket[] = bucketDefs.map((b) => ({ label: b.label, count: 0 }));

  planningTasks.forEach((t) => {
    const est = t.estimatedMinutes!;
    const actual = t.actualMinutes!;
    if (est === 0) return;
    const dev = (actual - est) / est;
    const idx = bucketDefs.findIndex((b) => dev >= b.min && dev < b.max);
    if (idx !== -1) deviationHistogram[idx].count++;
  });

  const planningFallacyTotal = planningTasks.length;
  const planningFallacyAvgBias =
    planningFallacyTotal > 0
      ? Math.round(
          (planningTasks.reduce((sum, t) => sum + ((t.actualMinutes! - t.estimatedMinutes!) / t.estimatedMinutes!), 0) /
            planningFallacyTotal) * 100
        )
      : null;

  // ── 5.4 Energy trend ──────────────────────────────────────────────────────
  // Merge energy check-ins with completedPerDay for a combined day-by-day dataset
  const energyByDate: Record<string, number> = {};
  energyCheckIns.forEach((e) => { energyByDate[e.date] = e.level; });

  const energyTrend = Object.entries(completedPerDay).map(([date, completed]) => ({
    date,
    completed,
    energy: energyByDate[date] ?? null,
  }));

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
    // Phase 5 additions
    planningByCategory,
    deviationHistogram,
    planningFallacyTotal,
    planningFallacyAvgBias,
    energyTrend,
  });
}
