import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Brak klucza API" }, { status: 503 });
  }

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [tasks, exams] = await Promise.all([
    prisma.task.findMany({
      where: { userId: session.user.id, done: false },
      orderBy: [{ deadline: "asc" }, { priority: "desc" }],
      take: 20,
      select: { title: true, deadline: true, priority: true, description: true },
    }),
    prisma.exam.findMany({
      where: { userId: session.user.id, examDate: { gte: now } },
      orderBy: { examDate: "asc" },
      take: 5,
      include: {
        studySessions: {
          where: { date: { gte: now, lte: in7days }, done: false },
          select: { date: true, topic: true, hours: true },
        },
      },
    }),
  ]);

  const todayStr = now.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  const prompt = `Dziś jest ${todayStr}.

Aktywne zadania (${tasks.length}):
${tasks.map((t) => `- "${t.title}" | deadline: ${t.deadline ? new Date(t.deadline).toLocaleDateString("pl-PL") : "brak"} | priorytet: ${t.priority}/5${t.description ? ` | "${t.description}"` : ""}`).join("\n")}

Nadchodzące egzaminy:
${exams.length === 0 ? "brak" : exams.map((e) => `- ${e.title} (${new Date(e.examDate).toLocaleDateString("pl-PL")}), sesje w tym tygodniu: ${e.studySessions.length}`).join("\n")}

Na podstawie powyższego napisz KRÓTKI (max 4 zdania) plan na dziś po polsku. Zacznij od najważniejszego zadania. Wspomnij o egzaminie jeśli jest w ciągu tygodnia. Bądź konkretny i motywujący. Bez wstępów, od razu do rzeczy.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ brief: text });
}
