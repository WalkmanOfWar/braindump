import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessions } from "@/lib/study-planner";
import type { ExamCreateInput } from "@/types";

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

  const body = (await req.json()) as ExamCreateInput;
  if (!body.title?.trim() || !body.examDate) {
    return NextResponse.json(
      { error: "Tytuł i data egzaminu są wymagane" },
      { status: 400 }
    );
  }

  const examDate = new Date(body.examDate);
  const sessions = generateSessions(examDate, body.dailyHours ?? 1, body.topics);

  const exam = await prisma.exam.create({
    data: {
      title: body.title.trim(),
      examDate,
      dailyHours: body.dailyHours ?? 1,
      categoryId: body.categoryId ?? null,
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
