import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// Vercel Cron Job — runs daily at 21:30 UTC (~23:30 CEST / 22:30 CET)
// Sends a reminder to consolidate today's study material during sleep.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const doneSessions = await prisma.studySession.findMany({
    where: {
      done: true,
      date: { gte: todayStart, lte: todayEnd },
    },
    include: { exam: { select: { userId: true, title: true } } },
  });

  if (doneSessions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Group topics by userId
  const byUser = new Map<string, string[]>();
  for (const session of doneSessions) {
    const userId = session.exam.userId;
    const topics = byUser.get(userId) ?? [];
    topics.push(session.topic);
    byUser.set(userId, topics);
  }

  const results = await Promise.allSettled(
    Array.from(byUser.entries()).map(([userId, topics]) => {
      const topicList = topics.slice(0, 3).join(", ");
      const suffix = topics.length > 3 ? ` i ${topics.length - 3} więcej` : "";
      return sendPushToUser(userId, {
        title: "🌙 Utrwal wiedzę we śnie",
        body: `Dzisiaj nauczyłeś się: ${topicList}${suffix}. Dobranoc!`,
        url: "/exams",
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  console.log(`[cron/sleep-consolidation] sent=${sent} users=${byUser.size}`);
  return NextResponse.json({ sent });
}
