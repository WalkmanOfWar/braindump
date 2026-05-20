import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import type { TaskUpdateInput } from "@/types";

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

  const body = (await req.json()) as TaskUpdateInput;
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.deadline !== undefined
        ? { deadline: body.deadline ? new Date(body.deadline) : null }
        : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.done !== undefined
        ? { done: body.done, doneAt: body.done ? new Date() : null }
        : {}),
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
