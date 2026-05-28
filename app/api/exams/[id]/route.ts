import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessions } from "@/lib/study-planner";
import { z } from "zod";

const HTTP_UNAUTHORIZED  = 401 as const;
const HTTP_NOT_FOUND     = 404 as const;
const HTTP_BAD_REQUEST   = 400 as const;
const HTTP_SERVER_ERROR  = 500 as const;
const HTTP_NO_CONTENT    = 204 as const;

const ExamUpdateSchema = z.object({
  title:       z.string().min(1).optional(),
  examDate:    z.string().optional(),
  dailyHours:  z.number().positive().optional(),
  categoryId:  z.string().nullable().optional(),
  interleaved: z.boolean().optional(),
  regenerate:  z.boolean().optional(),
  today:       z.string().optional(),
  topics:      z.array(z.string()).optional(),
});

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

async function findOwnedExam(id: string, userId: string) {
  const exam = await prisma.exam.findUnique({ where: { id }, include: { studySessions: true } });
  if (!exam || exam.userId !== userId) return null;
  return exam;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const { id } = await params;

  try {
    const exam = await findOwnedExam(id, session.user.id);
    if (!exam) {
      return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: HTTP_NOT_FOUND });
    }

    const parsed = ExamUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: HTTP_BAD_REQUEST });
    }

    const { title, examDate, dailyHours, categoryId, interleaved, regenerate, today, topics } = parsed.data;

    const updatedExam = await prisma.exam.update({
      where: { id },
      data: {
        ...(title !== undefined      && { title }),
        ...(examDate !== undefined   && { examDate: new Date(examDate) }),
        ...(dailyHours !== undefined && { dailyHours }),
        ...(categoryId !== undefined && { categoryId }),
        ...(interleaved !== undefined && { interleaved }),
      },
    });

    if (regenerate) {
      await prisma.studySession.deleteMany({ where: { examId: id } });

      const newExamDate    = examDate ? new Date(examDate) : exam.examDate;
      const newDailyHours  = dailyHours ?? exam.dailyHours;
      const newInterleaved = interleaved ?? updatedExam.interleaved;
      const sessions = generateSessions(newExamDate, newDailyHours, topics ?? [], today, newInterleaved);

      await prisma.studySession.createMany({
        data: sessions.map((s) => ({
          examId: id,
          date:   new Date(s.date),
          topic:  s.topic,
          hours:  s.hours,
          done:   false,
        })),
      });
    }

    const result = await prisma.exam.findUnique({
      where:   { id },
      include: { studySessions: { orderBy: { date: "asc" } }, category: true },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const { id } = await params;

  try {
    const exam = await findOwnedExam(id, session.user.id);
    if (!exam) {
      return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: HTTP_NOT_FOUND });
    }

    await prisma.exam.delete({ where: { id } });
    return new NextResponse(null, { status: HTTP_NO_CONTENT });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
