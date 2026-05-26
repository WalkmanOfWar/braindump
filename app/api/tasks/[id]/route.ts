import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { TaskUpdateSchema } from "@/lib/schemas";

async function getTaskOrFail(id: string, userId: string) {
  const task = await prisma.task.findFirst({ where: { id, userId } });
  if (!task) return null;
  return task;
}

function nextRecurrenceDate(deadline: Date, recurrence: string): Date {
  const d = new Date(deadline);
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }
  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    include: { category: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await getTaskOrFail(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: 404 });
  }

  const parsed = TaskUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: 400 }
    );
  }

  const { title, description, deadline, priority, categoryId, goalId, estimatedMinutes, done, recurrence, recurrenceEnd, subtasks, intentionWhen, intentionWhere } = parsed.data;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null, reminderSentAt: null } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(goalId !== undefined ? { goalId } : {}),
      ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
      ...(intentionWhen !== undefined ? { intentionWhen } : {}),
      ...(intentionWhere !== undefined ? { intentionWhere } : {}),
      ...(done !== undefined ? { done, doneAt: done ? new Date() : null } : {}),
      ...(recurrence !== undefined ? { recurrence } : {}),
      ...(recurrenceEnd !== undefined ? { recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null } : {}),
      ...(subtasks !== undefined ? { subtasks: subtasks ?? undefined } : {}),
    },
    include: { category: true },
  });

  // When completing a recurring task, spawn the next occurrence
  if (done === true && task.recurrence !== "none" && task.deadline) {
    const nextDeadline = nextRecurrenceDate(new Date(task.deadline), task.recurrence);
    const withinEnd = !task.recurrenceEnd || nextDeadline <= new Date(task.recurrenceEnd);
    if (withinEnd) {
      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          deadline: nextDeadline,
          priority: task.priority,
          categoryId: task.categoryId,
          userId: task.userId,
          recurrence: task.recurrence,
          recurrenceEnd: task.recurrenceEnd,
          // reset subtasks to all undone for next occurrence
          subtasks: Array.isArray(task.subtasks)
            ? (task.subtasks as { id: string; text: string; done: boolean }[]).map((s) => ({ ...s, done: false }))
            : undefined,
        },
      });
    }
  }

  return NextResponse.json(task);
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
  const existing = await getTaskOrFail(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: 404 });
  }

  if (existing.googleEventId) {
    try {
      await deleteCalendarEvent(session.user.id, existing.googleEventId);
    } catch {
      // nie blokuj usunięcia jeśli Google Calendar zawiedzie
    }
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
