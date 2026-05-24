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
  const todayStr = now.toLocaleDateString("sv-SE");

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id, done: false },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    take: 30,
    select: {
      id: true,
      title: true,
      deadline: true,
      priority: true,
      estimatedMinutes: true,
      description: true,
    },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ taskId: null, title: null, reason: "Nie masz żadnych aktywnych zadań. Czas na odpoczynek! 🎉" });
  }

  const hour = now.getHours();
  const timeOfDay =
    hour < 9 ? "wczesny ranek" :
    hour < 12 ? "przedpołudnie" :
    hour < 15 ? "południe" :
    hour < 19 ? "popołudnie" : "wieczór";

  const taskList = tasks.map((t) => {
    const daysLeft = t.deadline
      ? Math.ceil((new Date(t.deadline).getTime() - now.getTime()) / 86_400_000)
      : null;
    return `ID:${t.id} | "${t.title}" | priorytet:${t.priority}/5 | deadline:${daysLeft !== null ? `za ${daysLeft} dni` : "brak"} | czas:${t.estimatedMinutes ? `${t.estimatedMinutes}min` : "nieznany"}`;
  }).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Teraz jest ${timeOfDay} (${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}), data: ${todayStr}.

Zadania do zrobienia:
${taskList}

Wybierz JEDNO najważniejsze zadanie do zrobienia TERAZ. Odpowiedz tylko w tym formacie JSON (bez markdown):
{"taskId":"<ID>","reason":"<1-2 zdania po polsku dlaczego właśnie to zadanie teraz>"}

Weź pod uwagę: porę dnia, pilność deadlinów, priorytet, czas potrzebny na zadanie.`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
  try {
    const result = JSON.parse(text) as { taskId: string; reason: string };
    const task = tasks.find((t) => t.id === result.taskId);
    return NextResponse.json({
      taskId: result.taskId,
      title: task?.title ?? null,
      estimatedMinutes: task?.estimatedMinutes ?? null,
      reason: result.reason,
    });
  } catch {
    // Fallback: pick highest priority task with nearest deadline
    const best = tasks[0];
    return NextResponse.json({
      taskId: best.id,
      title: best.title,
      estimatedMinutes: best.estimatedMinutes,
      reason: "Zadanie o najwyższym priorytecie i najbliższym terminie.",
    });
  }
}
