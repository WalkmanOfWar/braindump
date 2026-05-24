import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoalCreateSchema } from "@/lib/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findFirst({ where: { id, userId: session.user.id } });
  if (!goal) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  const parsed = GoalCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { deadline, ...rest } = parsed.data;

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      ...rest,
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
    },
    include: { tasks: { select: { id: true, title: true, done: true, priority: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findFirst({ where: { id, userId: session.user.id } });
  if (!goal) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  // Soft-delete — unlink tasks first so they don't cascade away
  await prisma.$transaction([
    prisma.task.updateMany({ where: { goalId: id }, data: { goalId: null } }),
    prisma.goal.update({ where: { id }, data: { archivedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true });
}
