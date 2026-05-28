import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_NOT_FOUND    = 404 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_CREATED      = 201 as const;
const HTTP_SERVER_ERROR = 500 as const;

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

    const cards = await prisma.flashcard.findMany({ where: { deckId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(cards);
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
    const parsed = FlashcardCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: HTTP_BAD_REQUEST });
    }

    const card = await prisma.flashcard.create({ data: { ...parsed.data, deckId } });
    return NextResponse.json(card, { status: HTTP_CREATED });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
