import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [decks, recentReviews, velocityReviews] = await Promise.all([
    prisma.flashcardDeck.findMany({
      where: { userId },
      include: {
        cards: { select: { id: true, state: true, stability: true } },
      },
    }),
    // Reviews in last 30 days — for retention rate
    prisma.flashcardReview.findMany({
      where: {
        card: { deck: { userId } },
        reviewedAt: { gte: thirtyDaysAgo },
      },
      select: { rating: true },
    }),
    // Reviews in last 14 days — for velocity (group by date)
    prisma.flashcardReview.findMany({
      where: {
        card: { deck: { userId } },
        reviewedAt: { gte: fourteenDaysAgo },
      },
      select: { reviewedAt: true },
    }),
  ]);

  // Retention rate: % reviews with rating >= 3 (Good / Easy)
  const retentionRate = recentReviews.length > 0
    ? Math.round((recentReviews.filter((r) => r.rating >= 3).length / recentReviews.length) * 100)
    : 0;

  // Card counts
  const allCards = decks.flatMap((d) => d.cards);
  const totalCards = allCards.length;
  const matureCount = allCards.filter((c) => c.state === 2).length; // state=2 → Review

  // Learning velocity: reviews per day over last 14 days
  const velocityMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    velocityMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const review of velocityReviews) {
    const key = review.reviewedAt.toISOString().split("T")[0];
    if (velocityMap.has(key)) {
      velocityMap.set(key, (velocityMap.get(key) ?? 0) + 1);
    }
  }
  const learningVelocity = Array.from(velocityMap.entries()).map(([date, count]) => ({ date, count }));

  // Per-deck stats
  const deckStats = decks.map((deck) => {
    const deckCards = deck.cards;
    const mature = deckCards.filter((c) => c.state === 2).length;
    const reviewed = deckCards.filter((c) => c.stability > 0);
    const avgStability = reviewed.length > 0
      ? Math.round((reviewed.reduce((sum, c) => sum + c.stability, 0) / reviewed.length) * 10) / 10
      : 0;
    return {
      id: deck.id,
      title: deck.title,
      emoji: deck.emoji,
      color: deck.color,
      total: deckCards.length,
      mature,
      avgStability,
    };
  });

  return NextResponse.json({ retentionRate, totalCards, matureCount, learningVelocity, deckStats });
}
