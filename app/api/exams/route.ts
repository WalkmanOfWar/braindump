import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessions } from "@/lib/study-planner";
import { ExamCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_CREATED      = 201 as const;
const HTTP_SERVER_ERROR = 500 as const;

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  try {
    const exams = await prisma.exam.findMany({
      where:   { userId: session.user.id },
      include: { studySessions: { orderBy: { date: "asc" } }, category: true },
      orderBy: { examDate: "asc" },
    });
    return NextResponse.json(exams);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const parsed = ExamCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const { title, examDate, dailyHours, topics, categoryId, interleaved, today } = parsed.data;
  const examDateObj = new Date(examDate);
  const sessions = generateSessions(examDateObj, dailyHours, topics, today, interleaved);

  try {
    const exam = await prisma.exam.create({
      data: {
        title:      title.trim(),
        examDate:   examDateObj,
        dailyHours,
        interleaved,
        categoryId: categoryId ?? null,
        userId:     session.user.id,
        studySessions: {
          create: sessions.map((s) => ({
            date:  new Date(s.date),
            topic: s.topic,
            hours: s.hours,
          })),
        },
      },
      include: { studySessions: { orderBy: { date: "asc" } }, category: true },
    });
    return NextResponse.json(exam, { status: HTTP_CREATED });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
