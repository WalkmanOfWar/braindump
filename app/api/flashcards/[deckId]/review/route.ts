import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewSchema } from "@/lib/schemas";
import { scheduleCard } from "@/lib/fsrs";
import type { Rating } from "@/lib/fsrs";

type Params = { params: Promise<{ deckId: string }> };

const MAX_REVIEW_BATCH = 20;

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;

  const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId: session.user.id } });
  if (!deck) return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });

  const now = new Date();
  const due = await prisma.flashcard.findMany({
    where: { deckId, due: { lte: now } },
    orderBy: [{ state: "asc" }, { due: "asc" }],
    take: MAX_REVIEW_BATCH,
  });

  return NextResponse.json(due);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;

  const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId: session.user.id } });
  if (!deck) return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });

  const body: unknown = await req.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { cardId, rating } = parsed.data;

  const card = await prisma.flashcard.findFirst({ where: { id: cardId, deckId } });
  if (!card) return NextResponse.json({ error: "Nie znaleziono karty" }, { status: 404 });

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
}
