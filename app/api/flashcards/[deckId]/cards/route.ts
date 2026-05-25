import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardCreateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ deckId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;

  const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId: session.user.id } });
  if (!deck) return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });

  const cards = await prisma.flashcard.findMany({ where: { deckId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId } = await params;

  const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId: session.user.id } });
  if (!deck) return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });

  const body: unknown = await req.json();
  const parsed = FlashcardCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const card = await prisma.flashcard.create({ data: { ...parsed.data, deckId } });
  return NextResponse.json(card, { status: 201 });
}
