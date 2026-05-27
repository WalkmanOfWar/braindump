import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminder } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/push";

// Vercel Cron Job — runs hourly at :00
// Checks each user's reminderHoursBefore preference, skips users with reminderEnabled=false
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const now = new Date();

  // Fetch all unique reminderHoursBefore values in use to build time windows
  const WINDOW_HOURS = [1, 2, 6, 24, 48] as const;

  // For each window, find tasks whose deadline falls in [now + window - 30min, now + window + 30min]
  // and whose user has that exact preference set. The ±30min buffer handles cron drift.
  const results = await Promise.allSettled(
    WINDOW_HOURS.map(async (hours) => {
      const windowStart = new Date(now.getTime() + (hours * 60 - 30) * 60_000);
      const windowEnd   = new Date(now.getTime() + (hours * 60 + 30) * 60_000);

      const tasks = await prisma.task.findMany({
        where: {
          done: false,
          deadline: { gt: windowStart, lte: windowEnd },
          reminderSentAt: null,
          user: { reminderEnabled: true, reminderHoursBefore: hours },
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      });

      return Promise.allSettled(
        tasks.map(async (task) => {
          if (!task.user.email || !task.deadline) return;

          await Promise.allSettled([
            sendDeadlineReminder(task.user.email, task.title, task.deadline),
            sendPushToUser(task.userId, {
              title: "⏰ Zbliża się termin",
              body: `„${task.title}" — za ${hours === 1 ? "godzinę" : hours < 24 ? `${hours} godz` : hours === 24 ? "dobę" : "2 dni"}`,
              url: "/tasks",
            }),
          ]);

          await prisma.task.update({
            where: { id: task.id },
            data: { reminderSentAt: now },
          });
        })
      );
    })
  );

  const sent = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value.filter((v) => v.status === "fulfilled") : []
  ).length;

  console.log(`[cron/reminders] sent=${sent}`);
  return NextResponse.json({ sent });
}
