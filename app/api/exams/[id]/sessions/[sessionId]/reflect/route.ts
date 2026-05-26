import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateReflection } from "@/lib/claude";
import { z } from "zod";

const ReflectSchema = z.object({
  reflection: z.string().min(1, "Treść refleksji jest wymagana").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id: examId, sessionId } = await params;

  const parsed = ReflectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }

  const { reflection } = parsed.data;

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    include: { exam: { select: { userId: true } } },
  });

  if (!session || session.examId !== examId || session.exam.userId !== auth.user.id) {
    return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: 404 });
  }

  // Save reflection text to session
  await prisma.studySession.update({
    where: { id: sessionId },
    data: { reflection },
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ feedback: "Brak klucza ANTHROPIC_API_KEY — ocena AI niedostępna." });
  }

  const feedback = await evaluateReflection(session.topic, reflection);

  return NextResponse.json({ feedback });
}
