import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const GENERATE_SYSTEM = `Jesteś ekspertem w tworzeniu fiszek do nauki metodą spaced repetition (powtarzania w odstępach).

Zasady tworzenia dobrych fiszek:
- Jedna karta = jeden fakt / jedno pojęcie (zasada minimalnych informacji)
- Pytanie (front): konkretne, jednoznaczne, bez zbędnego kontekstu
- Odpowiedź (back): możliwie krótka, ale kompletna — 1-3 zdania
- Unikaj "co to jest X?" — lepiej: "Podaj definicję X" lub "Jaka jest różnica między X a Y?"
- Dla wzorów: front = opis sytuacji, back = wzór + wyjaśnienie
- Dla dat: front = wydarzenie, back = data + krótki kontekst
- Pisz po polsku

Odpowiedz WYŁĄCZNIE czystą tablicą JSON bez markdown:
[{"front": "...", "back": "..."}]`;

const RequestSchema = z.object({
  deckId: z.string(),
  topics: z.array(z.string()).min(1),
  count: z.number().int().min(3).max(30).default(10),
});

const GeneratedCardsSchema = z.array(z.object({
  front: z.string().min(1),
  back: z.string().min(1),
})).min(1);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Brak klucza API Anthropic. Dodaj ANTHROPIC_API_KEY do zmiennych środowiskowych." },
      { status: 503 }
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: 400 }
    );
  }

  const { deckId, topics, count } = parsed.data;

  const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId: session.user.id } });
  if (!deck) return NextResponse.json({ error: "Nie znaleziono talii" }, { status: 404 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [{ type: "text", text: GENERATE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Wygeneruj dokładnie ${count} fiszek do nauki następujących tematów:\n${topics.map((t) => `- ${t}`).join("\n")}\n\nTalia: "${deck.title}"`,
        },
      ],
    });

    const firstBlock = msg.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      return NextResponse.json({ error: "AI zwróciło pustą odpowiedź" }, { status: 502 });
    }

    const parsedCards: unknown = JSON.parse(firstBlock.text.replace(/```json|```/g, "").trim());
    const cardsResult = GeneratedCardsSchema.safeParse(parsedCards);
    if (!cardsResult.success) {
      return NextResponse.json({ error: "AI zwróciło nieprawidłowy format fiszek" }, { status: 502 });
    }

    const created = await prisma.flashcard.createMany({
      data: cardsResult.data.map((c) => ({ front: c.front, back: c.back, deckId })),
    });

    return NextResponse.json({ created: created.count, cards: cardsResult.data });
  } catch (error) {
    console.error("[generate-flashcards]", error);
    return NextResponse.json(
      { error: "Nie udało się wygenerować fiszek. Spróbuj ponownie za chwilę." },
      { status: 500 }
    );
  }
}
