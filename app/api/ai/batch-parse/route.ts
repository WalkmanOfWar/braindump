import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { batchParseTasksFromText } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza API Anthropic" }, { status: 503 });
  }

  const body = await req.json();
  const { lines, categories } = body as {
    lines: string[];
    categories?: { id: string; name: string }[];
  };

  const nonEmpty = (lines ?? []).filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) {
    return NextResponse.json({ error: "Brak notatek do przeanalizowania" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const results = await batchParseTasksFromText(nonEmpty, categories ?? [], today);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Błąd parsowania AI — spróbuj ponownie" }, { status: 500 });
  }
}
