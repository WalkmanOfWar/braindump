import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateStudyPrompts } from "@/lib/claude";
import { z } from "zod";

const Schema = z.object({
  topic: z.string().min(1).max(200),
  examTitle: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const { topic, examTitle } = parsed.data;
  const result = await generateStudyPrompts(topic, examTitle);
  return NextResponse.json(result);
}
