import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessions } from "@/lib/study-planner";
import { z } from "zod";

const ExamUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  examDate: z.string().optional(),
  dailyHours: z.number().positive().optional(),
  categoryId: z.string().nullable().optional(),
  regenerate: z.boolean().optional(), // if true, delete old sessions and regenerate
  today: z.string().optional(),       // client's local date for session generation
  topics: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { studySessions: true },
  });
  if (!exam || exam.userId !== session.user.id) {
    return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: 404 });
  }

  const parsed = ExamUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const { title, examDate, dailyHours, categoryId, regenerate, today, topics } = parsed.data;

  const updatedExam = await prisma.exam.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(examDate !== undefined && { examDate: new Date(examDate) }),
      ...(dailyHours !== undefined && { dailyHours }),
      ...(categoryId !== undefined && { categoryId }),
    },
  });

  if (regenerate) {
    await prisma.studySession.deleteMany({ where: { examId: id } });

    const newExamDate = examDate ? new Date(examDate) : exam.examDate;
    const newDailyHours = dailyHours ?? exam.dailyHours;
    const sessions = generateSessions(newExamDate, newDailyHours, topics ?? [], today);

    await prisma.studySession.createMany({
      data: sessions.map((s) => ({
        examId: id,
        date: new Date(s.date),
        topic: s.topic,
        hours: s.hours,
        done: false,
      })),
    });
  }

  const result = await prisma.exam.findUnique({
    where: { id },
    include: { studySessions: { orderBy: { date: "asc" } }, category: true },
  });

  return NextResponse.json(result);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const { id } = await params;

  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam || exam.userId !== session.user.id) {
    return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: 404 });
  }

  await prisma.exam.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
