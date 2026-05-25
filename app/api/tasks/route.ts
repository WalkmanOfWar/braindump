import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const goalId = searchParams.get("goalId");
  const done = searchParams.get("done");

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      ...(categoryId ? { categoryId } : {}),
      ...(goalId ? { goalId } : {}),
      ...(done !== null ? { done: done === "true" } : {}),
    },
    include: { category: true },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const parsed = TaskCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: 400 }
    );
  }

  const { title, description, deadline, priority, categoryId, goalId, estimatedMinutes, recurrence, recurrenceEnd, subtasks } = parsed.data;

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description,
      deadline: deadline ? new Date(deadline) : null,
      priority,
      categoryId: categoryId ?? null,
      goalId: goalId ?? null,
      estimatedMinutes: estimatedMinutes ?? null,
      userId: session.user.id,
      recurrence: recurrence ?? "none",
      recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
      subtasks: subtasks ?? undefined,
    },
    include: { category: true },
  });

  return NextResponse.json(task, { status: 201 });
}
