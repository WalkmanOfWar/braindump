import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoalCreateSchema } from "@/lib/schemas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id, archivedAt: null },
    include: {
      tasks: {
        where: { done: false },
        select: { id: true, title: true, done: true, priority: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const parsed = GoalCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { deadline, ...rest } = parsed.data;

  const goal = await prisma.goal.create({
    data: {
      ...rest,
      deadline: deadline ? new Date(deadline) : null,
      userId: session.user.id,
    },
    include: { tasks: true },
  });

  return NextResponse.json(goal, { status: 201 });
}
