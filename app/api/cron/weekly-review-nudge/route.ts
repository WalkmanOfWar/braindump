import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// Vercel Cron — runs Sunday 18:00 UTC (20:00 Polish summer time)
// Nudges users who completed at least one task this week to check their weekly review.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Find users with at least one task completed in the last 7 days
  const recentDone = await prisma.task.findMany({
    where: { done: true, doneAt: { gte: weekAgo } },
    select: { userId: true },
    distinct: ["userId"],
  });

  let sent = 0;
  await Promise.allSettled(
    recentDone.map(async ({ userId }) => {
      await sendPushToUser(userId, {
        title: "📊 Twój tygodniowy przegląd jest gotowy",
        body: "Zobacz co osiągnięto w tym tygodniu i zaplanuj następny",
        url: "/review",
      });
      sent++;
    })
  );

  console.log(`[cron/weekly-review-nudge] sent=${sent}`);
  return NextResponse.json({ sent });
}
