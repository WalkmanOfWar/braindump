import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardCreateSchema } from "@/lib/schemas";

type Params = { params: Promise<{ deckId: string; cardId: string }> };

async function ownedCard(userId: string, deckId: string, cardId: string) {
  return prisma.flashcard.findFirst({
    where: { id: cardId, deckId, deck: { userId } },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId, cardId } = await params;
  if (!(await ownedCard(session.user.id, deckId, cardId))) {
    return NextResponse.json({ error: "Nie znaleziono karty" }, { status: 404 });
  }

  const body: unknown = await req.json();
  const parsed = FlashcardCreateSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const updated = await prisma.flashcard.update({ where: { id: cardId }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { deckId, cardId } = await params;
  if (!(await ownedCard(session.user.id, deckId, cardId))) {
    return NextResponse.json({ error: "Nie znaleziono karty" }, { status: 404 });
  }

  await prisma.flashcard.delete({ where: { id: cardId } });
  return NextResponse.json({ ok: true });
}
