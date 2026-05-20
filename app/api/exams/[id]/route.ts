import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }
  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, userId: session.user.id },
    include: { studySessions: { orderBy: { date: "asc" } }, category: true },
  });
  if (!exam) {
    return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: 404 });
  }
  return NextResponse.json(exam);
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
  const existing = await prisma.exam.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nie znaleziono egzaminu" }, { status: 404 });
  }
  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
