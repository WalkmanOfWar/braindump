import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTasksFromProse } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza API Anthropic" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const text = body?.text as string | undefined;

  if (!text || text.trim().length < 5) {
    return NextResponse.json({ error: "Tekst zbyt krótki" }, { status: 400 });
  }

  // Hard cap to avoid runaway costs (Claude can handle, but no point)
  const MAX_INPUT = 8000;
  const truncated = text.length > MAX_INPUT ? text.slice(0, MAX_INPUT) : text;

  const [categories, goals] = await Promise.all([
    prisma.category.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true },
    }),
    prisma.goal.findMany({
      where: { userId: session.user.id, archivedAt: null },
      select: { id: true, title: true },
    }),
  ]);

  try {
    const today = new Date().toLocaleDateString("sv-SE");
    const extracted = await extractTasksFromProse(truncated, categories, goals, today);
    return NextResponse.json({ tasks: extracted });
  } catch (err) {
    console.error("[extract-tasks]", err);
    return NextResponse.json({ error: "Nie udało się wyodrębnić zadań" }, { status: 500 });
  }
}
