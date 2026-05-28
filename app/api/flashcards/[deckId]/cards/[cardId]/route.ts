import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_NOT_FOUND    = 404 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_SERVER_ERROR = 500 as const;

type Params = { params: Promise<{ deckId: string; cardId: string }> };

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

async function findOwnedCard(userId: string, deckId: string, cardId: string) {
  return prisma.flashcard.findFirst({
    where: { id: cardId, deckId, deck: { userId } },
  });
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const { deckId, cardId } = await params;

  try {
    const card = await findOwnedCard(session.user.id, deckId, cardId);
    if (!card) {
      return NextResponse.json({ error: "Nie znaleziono karty" }, { status: HTTP_NOT_FOUND });
    }

    const body: unknown = await req.json();
    const parsed = FlashcardCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: HTTP_BAD_REQUEST });
    }

    const updated = await prisma.flashcard.update({ where: { id: cardId }, data: parsed.data });
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

  const { deckId, cardId } = await params;

  try {
    const card = await findOwnedCard(session.user.id, deckId, cardId);
    if (!card) {
      return NextResponse.json({ error: "Nie znaleziono karty" }, { status: HTTP_NOT_FOUND });
    }

    await prisma.flashcard.delete({ where: { id: cardId } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
