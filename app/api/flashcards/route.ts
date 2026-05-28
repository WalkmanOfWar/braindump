import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeckCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_CREATED      = 201 as const;
const HTTP_SERVER_ERROR = 500 as const;

/** Max review rows fetched for curve-marker aggregation across all decks. */
const MAX_REVIEW_ROWS = 200 as const;
/** Max recent review dates kept per deck (for forgetting-curve markers). */
const MAX_REVIEWS_PER_DECK = 20 as const;

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const dueOnly = req.nextUrl.searchParams.get("dueOnly") === "true";
  const now = new Date();

  try {
    const decks = await prisma.flashcardDeck.findMany({
      where:   { userId: session.user.id },
      include: { _count: { select: { cards: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (dueOnly) {
      const totalDue = await prisma.flashcard.count({
        where: {
          deck: { userId: session.user.id },
          due:  { lte: now },
        },
      });
      return NextResponse.json({ dueCount: totalDue });
    }

    const deckIds = decks.map((d) => d.id);
    const [dueCounts, newCounts, stabilityRows, reviewRows] = await Promise.all([
      prisma.flashcard.groupBy({
        by:    ["deckId"],
        where: { deckId: { in: deckIds }, due: { lte: now } },
        _count: { id: true },
      }),
      prisma.flashcard.groupBy({
        by:    ["deckId"],
        where: { deckId: { in: deckIds }, state: 0 },
        _count: { id: true },
      }),
      // Average stability per deck (for forgetting curve)
      prisma.flashcard.groupBy({
        by:    ["deckId"],
        where: { deckId: { in: deckIds }, stability: { gt: 0 } },
        _avg:  { stability: true },
      }),
      // Last review dates per deck (for curve markers)
      prisma.flashcardReview.findMany({
        where:   { card: { deckId: { in: deckIds } } },
        select:  { reviewedAt: true, card: { select: { deckId: true } } },
        orderBy: { reviewedAt: "desc" },
        take:    MAX_REVIEW_ROWS,
      }),
    ]);

    const dueMap  = Object.fromEntries(dueCounts.map((r) => [r.deckId, r._count.id]));
    const newMap  = Object.fromEntries(newCounts.map((r) => [r.deckId, r._count.id]));
    const stabMap = Object.fromEntries(stabilityRows.map((r) => [r.deckId, r._avg.stability ?? 0]));

    // Group recent review dates by deckId (up to MAX_REVIEWS_PER_DECK per deck)
    const reviewMap: Record<string, string[]> = {};
    for (const row of reviewRows) {
      const deckId = row.card.deckId;
      if (!reviewMap[deckId]) reviewMap[deckId] = [];
      if (reviewMap[deckId].length < MAX_REVIEWS_PER_DECK) {
        reviewMap[deckId].push(row.reviewedAt.toISOString());
      }
    }

    const result = decks.map((deck) => ({
      ...deck,
      dueCount:      dueMap[deck.id]  ?? 0,
      newCount:      newMap[deck.id]  ?? 0,
      avgStability:  stabMap[deck.id] ?? 0,
      recentReviews: reviewMap[deck.id] ?? [],
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const body: unknown = await req.json();
  const parsed = DeckCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: HTTP_BAD_REQUEST });
  }

  try {
    const deck = await prisma.flashcardDeck.create({
      data: { ...parsed.data, userId: session.user.id },
    });
    return NextResponse.json(deck, { status: HTTP_CREATED });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
