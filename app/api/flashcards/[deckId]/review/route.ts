import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewSchema } from "@/lib/schemas";
import { scheduleCard } from "@/lib/fsrs";
import type { Rating } from "@/lib/fsrs";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_NOT_FOUND    = 404 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_SERVER_ERROR = 500 as const;

/** Max cards returned per review session batch. */
const MAX_REVIEW_BATCH = 20 as const;

type Params = { params: Promise<{ deckId: string }> };

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

async function findOwnedDeck(userId: string, deckId: string) {
  return prisma.flashcardDeck.findFirst({ where: { id: deckId, userId } });
}

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const { deckId } = await params;

  try {
    const deck = await findOwnedDeck(session.user.id, deckId);
    if (!deck) {
      return NextResponse.json({ error: "Nie znaleziono talii" }, { status: HTTP_NOT_FOUND });
    }

    const now = new Date();
    const due = await prisma.flashcard.findMany({
      where:   { deckId, due: { lte: now } },
      orderBy: [{ state: "asc" }, { due: "asc" }],
      take:    MAX_REVIEW_BATCH,
    });

    return NextResponse.json(due);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const { deckId } = await params;

  try {
    const deck = await findOwnedDeck(session.user.id, deckId);
    if (!deck) {
      return NextResponse.json({ error: "Nie znaleziono talii" }, { status: HTTP_NOT_FOUND });
    }

    const body: unknown = await req.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: HTTP_BAD_REQUEST });
    }

    const { cardId, rating } = parsed.data;

    const card = await prisma.flashcard.findFirst({ where: { id: cardId, deckId } });
    if (!card) {
      return NextResponse.json({ error: "Nie znaleziono karty" }, { status: HTTP_NOT_FOUND });
    }

    const now = new Date();
    const fsrsCard = {
      stability:     card.stability,
      difficulty:    card.difficulty,
      elapsedDays:   card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reps:          card.reps,
      lapses:        card.lapses,
      state:         card.state,
      due:           card.due,
    };

    const next = scheduleCard(fsrsCard, rating as Rating, now);

    const [updated] = await prisma.$transaction([
      prisma.flashcard.update({
        where: { id: cardId },
        data: {
          stability:     next.stability,
          difficulty:    next.difficulty,
          elapsedDays:   next.elapsedDays,
          scheduledDays: next.scheduledDays,
          reps:          next.reps,
          lapses:        next.lapses,
          state:         next.state,
          due:           next.due,
        },
      }),
      prisma.flashcardReview.create({
        data: { cardId, rating, reviewedAt: now },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
