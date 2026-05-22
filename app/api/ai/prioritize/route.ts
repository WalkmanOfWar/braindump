import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prioritizeTasks } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const body = (await req.json()) as { tasks: { id: string; title: string; deadline?: string }[] };
  if (!body.tasks?.length) {
    return NextResponse.json({ error: "Brak zadań do priorytetyzacji" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza API" }, { status: 503 });
  }

  try {
    const result = await prioritizeTasks(body.tasks);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Błąd usługi AI — spróbuj ponownie" },
      { status: 500 }
    );
  }
}
