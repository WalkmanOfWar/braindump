import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_NOT_FOUND    = 404 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_SERVER_ERROR = 500 as const;

/** Days to next review based on confidence level (Spaced Practice SRS). */
const REVIEW_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

/** Default interval used when confidence value has no mapping. */
const DEFAULT_REVIEW_INTERVAL_DAYS = 7 as const;

const MS_PER_DAY = 86_400_000 as const;

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }
  const { id: examId } = await params;

  const body = (await req.json()) as {
    sessionId:   string;
    done:        boolean;
    confidence?: number;
    notes?:      string;
    reflection?: string;
  };

  if (!body.sessionId) {
    return NextResponse.json({ error: "Brak sessionId" }, { status: HTTP_BAD_REQUEST });
  }

  try {
    const studySession = await prisma.studySession.findFirst({
      where:   { id: body.sessionId, examId },
      include: { exam: { select: { userId: true } } },
    });

    if (!studySession || studySession.exam.userId !== session.user.id) {
      return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: HTTP_NOT_FOUND });
    }

    // Compute nextReviewAt from confidence when marking done
    let nextReviewAt: Date | null = null;
    if (body.done && body.confidence != null) {
      const days = REVIEW_INTERVAL_DAYS[body.confidence] ?? DEFAULT_REVIEW_INTERVAL_DAYS;
      nextReviewAt = new Date(Date.now() + days * MS_PER_DAY);
    }

    const updated = await prisma.studySession.update({
      where: { id: body.sessionId },
      data: {
        done: body.done,
        ...(body.confidence != null  ? { confidence:   body.confidence  } : {}),
        ...(nextReviewAt             ? { nextReviewAt }                    : {}),
        ...(body.notes !== undefined ? { notes:        body.notes       } : {}),
        ...(body.reflection !== undefined ? { reflection: body.reflection } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
