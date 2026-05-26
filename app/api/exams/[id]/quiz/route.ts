import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const QuizSaveSchema = z.object({
  sessionId: z.string().optional(),
  type: z.enum(["pre", "post"]),
  questions: z.array(z.unknown()),
  answers: z.array(z.object({ questionIndex: z.number(), answer: z.number() })).optional(),
  score: z.number().int().min(0).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.userId !== auth.user.id) {
    return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: 404 });
  }

  const parsed = QuizSaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }

  const { sessionId, type, questions, answers, score } = parsed.data;

  const quiz = await prisma.quiz.create({
    data: {
      examId,
      sessionId: sessionId ?? null,
      type,
      questions: questions as Prisma.InputJsonValue,
      answers: answers !== undefined ? (answers as Prisma.InputJsonValue) : Prisma.JsonNull,
      score: score ?? null,
    },
  });

  return NextResponse.json(quiz, { status: 201 });
}
