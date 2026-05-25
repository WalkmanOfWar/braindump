import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// Vercel Cron — runs daily at 19:00 UTC (21:00 Polish summer time)
// Notifies users with active habits not yet completed today.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const today = new Date().toLocaleDateString("sv-SE");

  // Group habits by user, include today's completion status
  const habits = await prisma.habit.findMany({
    where: { archivedAt: null },
    include: {
      completions: { where: { date: today } },
    },
  });

  const byUser = new Map<string, { total: number; done: number }>();
  for (const h of habits) {
    const cur = byUser.get(h.userId) ?? { total: 0, done: 0 };
    cur.total++;
    if (h.completions.length > 0) cur.done++;
    byUser.set(h.userId, cur);
  }

  let sent = 0;
  await Promise.allSettled(
    Array.from(byUser.entries()).map(async ([userId, { total, done }]) => {
      if (done >= total) return; // all done — no nag
      const remaining = total - done;
      await sendPushToUser(userId, {
        title: "🔥 Nie zerwij passy",
        body: `Masz jeszcze ${remaining} ${remaining === 1 ? "nawyk" : "nawyków"} do odhaczenia dziś`,
        url: "/habits",
      });
      sent++;
    })
  );

  console.log(`[cron/habit-reminders] sent=${sent}`);
  return NextResponse.json({ sent });
}
