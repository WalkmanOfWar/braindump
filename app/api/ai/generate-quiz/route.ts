import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateQuiz } from "@/lib/claude";
import { z } from "zod";

const GenerateQuizSchema = z.object({
  topic: z.string().min(1).max(200),
  examTitle: z.string().min(1).max(200),
  type: z.enum(["pre", "post"]),
  count: z.number().int().min(3).max(10).default(5),
});

export async function POST(req: NextRequest) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza API Anthropic" }, { status: 503 });
  }

  const parsed = GenerateQuizSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }

  try {
    const questions = await generateQuiz(parsed.data.topic, parsed.data.examTitle, parsed.data.count);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[generate-quiz]", err);
    return NextResponse.json({ error: "Nie udało się wygenerować quizu" }, { status: 500 });
  }
}
