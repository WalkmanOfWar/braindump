import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeckCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const dueOnly = req.nextUrl.searchParams.get("dueOnly") === "true";
  const now = new Date();

  const decks = await prisma.flashcardDeck.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (dueOnly) {
    const totalDue = await prisma.flashcard.count({
      where: {
        deck: { userId: session.user.id },
        due: { lte: now },
      },
    });
    return NextResponse.json({ dueCount: totalDue });
  }

  const deckIds = decks.map((d) => d.id);
  const [dueCounts, newCounts] = await Promise.all([
    prisma.flashcard.groupBy({
      by: ["deckId"],
      where: { deckId: { in: deckIds }, due: { lte: now } },
      _count: { id: true },
    }),
    prisma.flashcard.groupBy({
      by: ["deckId"],
      where: { deckId: { in: deckIds }, state: 0 },
      _count: { id: true },
    }),
  ]);

  const dueMap = Object.fromEntries(dueCounts.map((r) => [r.deckId, r._count.id]));
  const newMap  = Object.fromEntries(newCounts.map((r) => [r.deckId, r._count.id]));

  const result = decks.map((deck) => ({
    ...deck,
    dueCount: dueMap[deck.id] ?? 0,
    newCount: newMap[deck.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = DeckCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const deck = await prisma.flashcardDeck.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(deck, { status: 201 });
}
