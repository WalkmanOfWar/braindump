import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — no auth required
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const user = await prisma.user.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, image: true },
  });

  if (!user) return NextResponse.json({ error: "Nie znaleziono profilu" }, { status: 404 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    tasksCompletedWeek,
    tasksCompletedMonth,
    studySessionsWeek,
    flashcardReviewsWeek,
    totalFlashcards,
    activeTasksCount,
  ] = await Promise.all([
    prisma.task.count({ where: { userId: user.id, done: true, doneAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { userId: user.id, done: true, doneAt: { gte: monthAgo } } }),
    prisma.studySession.count({ where: { exam: { userId: user.id }, done: true, date: { gte: weekAgo } } }),
    prisma.flashcardReview.count({ where: { card: { deck: { userId: user.id } }, reviewedAt: { gte: weekAgo } } }),
    prisma.flashcard.count({ where: { deck: { userId: user.id } } }),
    prisma.task.count({ where: { userId: user.id, done: false } }),
  ]);

  return NextResponse.json({
    name: user.name,
    image: user.image,
    stats: {
      tasksCompletedWeek,
      tasksCompletedMonth,
      studySessionsWeek,
      flashcardReviewsWeek,
      totalFlashcards,
      activeTasksCount,
    },
  });
}
