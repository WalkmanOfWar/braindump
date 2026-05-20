import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }
  const { id: examId } = await params;

  const body = (await req.json()) as { sessionId: string; done: boolean };
  if (!body.sessionId) {
    return NextResponse.json({ error: "Brak sessionId" }, { status: 400 });
  }

  const session_ = await prisma.studySession.findFirst({
    where: { id: body.sessionId, examId },
    include: { exam: { select: { userId: true } } },
  });

  if (!session_ || session_.exam.userId !== session.user.id) {
    return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: 404 });
  }

  const updated = await prisma.studySession.update({
    where: { id: body.sessionId },
    data: { done: body.done },
  });
  return NextResponse.json(updated);
}
