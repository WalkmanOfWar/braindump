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

  const { title, description, deadline, priority, categoryId, done } = parsed.data;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null, reminderSentAt: null } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(done !== undefined ? { done, doneAt: done ? new Date() : null } : {}),
    },
    include: { category: true },
  });

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
