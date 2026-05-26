import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const exams = await prisma.exam.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      title: true,
      studySessions: {
        where: { done: true, confidence: { not: null } },
        select: { topic: true, date: true, confidence: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { examDate: "asc" },
  });

  const result = exams
    .filter((exam) => exam.studySessions.length > 0)
    .map((exam) => {
      // Group sessions by topic, preserving first-seen order
      const topicMap = new Map<string, { date: string; confidence: number }[]>();
      for (const s of exam.studySessions) {
        const key = s.topic;
        const entries = topicMap.get(key) ?? [];
        entries.push({
          date: s.date.toISOString().split("T")[0],
          confidence: s.confidence!,
        });
        topicMap.set(key, entries);
      }

      return {
        id: exam.id,
        title: exam.title,
        topics: Array.from(topicMap.entries()).map(([topic, entries]) => ({ topic, entries })),
      };
    });

  return NextResponse.json({ exams: result });
}
