import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Days to next review based on confidence level (Spaced Practice SRS)
const REVIEW_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }
  const { id: examId } = await params;

  const body = (await req.json()) as {
    sessionId: string;
    done: boolean;
    confidence?: number;
    notes?: string;
    reflection?: string;
  };

  if (!body.sessionId) {
    return NextResponse.json({ error: "Brak sessionId" }, { status: 400 });
  }

  const session_ = await prisma.studySession.findFirst({
    where: { id: body.sessionId, examId },
    include: { exam: { select: { userId: true } } },
  });

  if (!session_ || session_.exam.userId !== session.user.id) {
    return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: 404 });
  }

  // Compute nextReviewAt from confidence when marking done
  let nextReviewAt: Date | null = null;
  if (body.done && body.confidence != null) {
    const days = REVIEW_INTERVAL_DAYS[body.confidence] ?? 7;
    nextReviewAt = new Date(Date.now() + days * 86_400_000);
  }

  const updated = await prisma.studySession.update({
    where: { id: body.sessionId },
    data: {
      done: body.done,
      ...(body.confidence != null ? { confidence: body.confidence } : {}),
      ...(nextReviewAt ? { nextReviewAt } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.reflection !== undefined ? { reflection: body.reflection } : {}),
    },
  });
  return NextResponse.json(updated);
}
