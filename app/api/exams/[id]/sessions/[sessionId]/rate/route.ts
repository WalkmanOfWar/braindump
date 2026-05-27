import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const RateSchema = z.object({
  confidence: z.number().int().min(1).max(5),
  notes: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id: examId, sessionId } = await params;

  const studySession = await prisma.studySession.findFirst({
    where: { id: sessionId, examId },
    include: { exam: { select: { userId: true, examDate: true, dailyHours: true } } },
  });

  if (!studySession || studySession.exam.userId !== auth.user.id) {
    return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: 404 });
  }

  const parsed = RateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }

  const { confidence, notes } = parsed.data;

  // Spaced Practice SRS: schedule next topic review based on confidence
  const REVIEW_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  const nextReviewAt = new Date(Date.now() + (REVIEW_DAYS[confidence] ?? 7) * 86_400_000);

  const updated = await prisma.studySession.update({
    where: { id: sessionId },
    data: { confidence, notes: notes ?? null, nextReviewAt },
  });

  // Low confidence (≤2) → try to schedule a retry session
  let retrySession = null;
  if (confidence <= 2) {
    const lastFuture = await prisma.studySession.findFirst({
      where: { examId, done: false },
      orderBy: { date: "desc" },
    });

    if (lastFuture) {
      const retryDate = new Date(lastFuture.date);
      retryDate.setDate(retryDate.getDate() + 1);
      retryDate.setHours(12, 0, 0, 0);

      const examCutoff = new Date(studySession.exam.examDate);
      examCutoff.setDate(examCutoff.getDate() - 1);
      examCutoff.setHours(12, 0, 0, 0);

      if (retryDate <= examCutoff) {
        retrySession = await prisma.studySession.create({
          data: {
            examId,
            date: retryDate,
            topic: `${studySession.topic} (powtórka)`,
            hours: studySession.exam.dailyHours,
            done: false,
          },
        });
      }
    }
  }

  return NextResponse.json({ session: updated, retrySession });
}
