import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { TaskUpdateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_NOT_FOUND    = 404 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_SERVER_ERROR = 500 as const;

const RECURRENCE_NONE    = "none"    as const;
const RECURRENCE_DAILY   = "daily"   as const;
const RECURRENCE_WEEKLY  = "weekly"  as const;
const RECURRENCE_MONTHLY = "monthly" as const;

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

async function findOwnedTask(id: string, userId: string) {
  return prisma.task.findFirst({ where: { id, userId } });
}

function nextRecurrenceDate(deadline: Date, recurrence: string): Date {
  const d = new Date(deadline);
  if      (recurrence === RECURRENCE_DAILY)   d.setDate(d.getDate() + 1);
  else if (recurrence === RECURRENCE_WEEKLY)  d.setDate(d.getDate() + 7);
  else if (recurrence === RECURRENCE_MONTHLY) d.setMonth(d.getMonth() + 1);
  return d;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }
  const { id } = await params;
  try {
    const task = await prisma.task.findFirst({
      where:   { id, userId: session.user.id },
      include: { category: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: HTTP_NOT_FOUND });
    }
    return NextResponse.json(task);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
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
    const existing = await findOwnedTask(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: HTTP_NOT_FOUND });
    }

    const parsed = TaskUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
        { status: HTTP_BAD_REQUEST }
      );
    }

    const {
      title, description, deadline, priority, categoryId, goalId,
      estimatedMinutes, actualMinutes, done, recurrence, recurrenceEnd,
      subtasks, intentionWhen, intentionWhere, isUrgent, isImportant,
      energyLevel, skipOccurrence,
    } = parsed.data;

    // Skip one occurrence: advance deadline by one period instead of completing
    if (skipOccurrence === true) {
      if (existing.recurrence === RECURRENCE_NONE || !existing.deadline) {
        return NextResponse.json({ error: "Zadanie nie jest cykliczne" }, { status: HTTP_BAD_REQUEST });
      }
      const nextDeadline = nextRecurrenceDate(new Date(existing.deadline), existing.recurrence);
      const pastEnd = existing.recurrenceEnd && nextDeadline > new Date(existing.recurrenceEnd);
      if (pastEnd) {
        await prisma.task.delete({ where: { id } });
        return NextResponse.json({ deleted: true });
      }
      const updated = await prisma.task.update({
        where:   { id },
        data:    { deadline: nextDeadline, reminderSentAt: null },
        include: { category: true },
      });
      return NextResponse.json(updated);
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title            !== undefined ? { title: title.trim() }                                              : {}),
        ...(description      !== undefined ? { description }                                                      : {}),
        ...(deadline         !== undefined ? { deadline: deadline ? new Date(deadline) : null, reminderSentAt: null } : {}),
        ...(priority         !== undefined ? { priority }                                                         : {}),
        ...(categoryId       !== undefined ? { categoryId }                                                       : {}),
        ...(goalId           !== undefined ? { goalId }                                                           : {}),
        ...(estimatedMinutes !== undefined ? { estimatedMinutes }                                                 : {}),
        ...(actualMinutes    !== undefined ? { actualMinutes }                                                    : {}),
        ...(intentionWhen    !== undefined ? { intentionWhen }                                                    : {}),
        ...(intentionWhere   !== undefined ? { intentionWhere }                                                   : {}),
        ...(isUrgent         !== undefined ? { isUrgent }                                                         : {}),
        ...(isImportant      !== undefined ? { isImportant }                                                      : {}),
        ...(energyLevel      !== undefined ? { energyLevel }                                                      : {}),
        ...(done             !== undefined ? { done, doneAt: done ? new Date() : null }                          : {}),
        ...(recurrence       !== undefined ? { recurrence }                                                       : {}),
        ...(recurrenceEnd    !== undefined ? { recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null }   : {}),
        ...(subtasks         !== undefined ? { subtasks: subtasks ?? undefined }                                  : {}),
      },
      include: { category: true },
    });

    // When completing a recurring task, spawn the next occurrence
    if (done === true && task.recurrence !== RECURRENCE_NONE && task.deadline) {
      const nextDeadline = nextRecurrenceDate(new Date(task.deadline), task.recurrence);
      const withinEnd = !task.recurrenceEnd || nextDeadline <= new Date(task.recurrenceEnd);
      if (withinEnd) {
        await prisma.task.create({
          data: {
            title:        task.title,
            description:  task.description,
            deadline:     nextDeadline,
            priority:     task.priority,
            categoryId:   task.categoryId,
            userId:       task.userId,
            recurrence:   task.recurrence,
            recurrenceEnd: task.recurrenceEnd,
            // reset subtasks to all-undone for the next occurrence
            subtasks: Array.isArray(task.subtasks)
              ? (task.subtasks as { id: string; text: string; done: boolean }[]).map(
                  (subtask) => ({ ...subtask, done: false })
                )
              : undefined,
          },
        });
      }
    }

    return NextResponse.json(task);
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
    const existing = await findOwnedTask(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: HTTP_NOT_FOUND });
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
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
