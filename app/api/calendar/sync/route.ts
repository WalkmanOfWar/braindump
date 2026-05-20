import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

type SyncBody = {
  type: "task" | "session";
  id: string;
  action: "create" | "delete";
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const body = (await req.json()) as SyncBody;

  try {
    if (body.type === "task") {
      const task = await prisma.task.findFirst({
        where: { id: body.id, userId: session.user.id },
      });
      if (!task) {
        return NextResponse.json({ error: "Nie znaleziono zadania" }, { status: 404 });
      }

      if (body.action === "create" && task.deadline) {
        const start = new Date(task.deadline);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const eventId = await createCalendarEvent(
          session.user.id,
          task.title,
          start,
          end,
          task.description ?? undefined
        );
        await prisma.task.update({ where: { id: body.id }, data: { googleEventId: eventId } });
        return NextResponse.json({ ok: true, eventId });
      }

      if (body.action === "delete" && task.googleEventId) {
        await deleteCalendarEvent(session.user.id, task.googleEventId);
        await prisma.task.update({ where: { id: body.id }, data: { googleEventId: null } });
        return NextResponse.json({ ok: true });
      }
    }

    if (body.type === "session") {
      const studySession = await prisma.studySession.findFirst({
        where: { id: body.id },
        include: { exam: { select: { userId: true, title: true } } },
      });
      if (!studySession || studySession.exam.userId !== session.user.id) {
        return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: 404 });
      }

      if (body.action === "create") {
        const start = new Date(studySession.date);
        const end = new Date(
          start.getTime() + studySession.hours * 60 * 60 * 1000
        );
        const eventId = await createCalendarEvent(
          session.user.id,
          `Nauka: ${studySession.exam.title} — ${studySession.topic}`,
          start,
          end
        );
        await prisma.studySession.update({
          where: { id: body.id },
          data: { googleEventId: eventId },
        });
        return NextResponse.json({ ok: true, eventId });
      }

      if (body.action === "delete" && studySession.googleEventId) {
        await deleteCalendarEvent(session.user.id, studySession.googleEventId);
        await prisma.studySession.update({
          where: { id: body.id },
          data: { googleEventId: null },
        });
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd";
    return NextResponse.json(
      { error: `Błąd synchronizacji z Google Calendar: ${message}` },
      { status: 500 }
    );
  }
}
