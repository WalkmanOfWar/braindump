import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseTaskFromText } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const body = await req.json();
  const { text, categories } = body as {
    text: string;
    categories: { id: string; name: string }[];
  };

  if (!text?.trim()) {
    return NextResponse.json({ error: "Brak tekstu" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Brak klucza API Anthropic" },
      { status: 503 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const parsed = await parseTaskFromText(text.trim(), categories ?? [], today);
  return NextResponse.json(parsed);
}
