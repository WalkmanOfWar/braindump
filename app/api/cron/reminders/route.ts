import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminder } from "@/lib/mailer";

// Vercel Cron Job — runs daily at 08:00 UTC (10:00 Polish summer time)
// Protected by CRON_SECRET environment variable
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find undone tasks with deadline in the next 24 hours that haven't been reminded yet
  const tasks = await prisma.task.findMany({
    where: {
      done: false,
      deadline: { gt: now, lte: in24h },
      reminderSentAt: null,
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      if (!task.user.email || !task.deadline) return;

      await sendDeadlineReminder(task.user.email, task.title, task.deadline);
      await prisma.task.update({
        where: { id: task.id },
        data: { reminderSentAt: now },
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[cron/reminders] sent=${sent} failed=${failed}`);
  return NextResponse.json({ sent, failed });
}
