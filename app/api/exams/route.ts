import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessions } from "@/lib/study-planner";
import { ExamCreateSchema } from "@/lib/schemas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const exams = await prisma.exam.findMany({
    where: { userId: session.user.id },
    include: { studySessions: { orderBy: { date: "asc" } }, category: true },
    orderBy: { examDate: "asc" },
  });
  return NextResponse.json(exams);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const parsed = ExamCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: 400 }
    );
  }

  const { title, examDate, dailyHours, topics, categoryId, interleaved, today } = parsed.data;
  const examDateObj = new Date(examDate);
  const sessions = generateSessions(examDateObj, dailyHours, topics, today, interleaved);

  const exam = await prisma.exam.create({
    data: {
      title: title.trim(),
      examDate: examDateObj,
      dailyHours,
      interleaved,
      categoryId: categoryId ?? null,
      userId: session.user.id,
      studySessions: {
        create: sessions.map((s) => ({
          date: new Date(s.date),
          topic: s.topic,
          hours: s.hours,
        })),
      },
    },
    include: { studySessions: { orderBy: { date: "asc" } }, category: true },
  });

  return NextResponse.json(exam, { status: 201 });
}
