import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeckCreateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ deckId: string }> };

async function ownedDeck(userId: string, deckId: string) {
  return prisma.flashcardDeck.findFirst({ where: { id: deckId, userId } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;
  const now = new Date();

  const deck = await prisma.flashcardDeck.findFirst({
    where: { id: deckId, userId: session.user.id },
    include: { cards: { orderBy: { due: "asc" } } },
  });

  if (!deck) return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });

  const dueCount = deck.cards.filter((c) => c.due <= now).length;
  const newCount  = deck.cards.filter((c) => c.state === 0).length;
  const learningCount = deck.cards.filter((c) => c.state === 1 || c.state === 3).length;
  const reviewCount   = deck.cards.filter((c) => c.state === 2).length;

  return NextResponse.json({ ...deck, dueCount, newCount, learningCount, reviewCount });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;
  if (!(await ownedDeck(session.user.id, deckId))) {
    return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = DeckCreateSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const updated = await prisma.flashcardDeck.update({ where: { id: deckId }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;
  if (!(await ownedDeck(session.user.id, deckId))) {
    return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });
  }

  await prisma.flashcardDeck.delete({ where: { id: deckId } });
  return NextResponse.json({ ok: true });
}
