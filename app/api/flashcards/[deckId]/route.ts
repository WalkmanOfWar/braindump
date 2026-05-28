import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeckCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_NOT_FOUND    = 404 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_SERVER_ERROR = 500 as const;

// Flashcard states (FSRS): 0=New, 1=Learning, 2=Review, 3=Relearning
const STATE_LEARNING   = 1 as const;
const STATE_REVIEW     = 2 as const;
const STATE_RELEARNING = 3 as const;

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
  const now = new Date();

  try {
    const deck = await prisma.flashcardDeck.findFirst({
      where:   { id: deckId, userId: session.user.id },
      include: { cards: { orderBy: { due: "asc" } } },
    });

    if (!deck) {
      return NextResponse.json({ error: "Nie znaleziono talii" }, { status: HTTP_NOT_FOUND });
    }

    const dueCount      = deck.cards.filter((c) => c.due <= now).length;
    const newCount      = deck.cards.filter((c) => c.state === 0).length;
    const learningCount = deck.cards.filter((c) => c.state === STATE_LEARNING || c.state === STATE_RELEARNING).length;
    const reviewCount   = deck.cards.filter((c) => c.state === STATE_REVIEW).length;

    return NextResponse.json({ ...deck, dueCount, newCount, learningCount, reviewCount });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
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
    const parsed = DeckCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: HTTP_BAD_REQUEST });
    }

    const updated = await prisma.flashcardDeck.update({ where: { id: deckId }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
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

    await prisma.flashcardDeck.delete({ where: { id: deckId } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
