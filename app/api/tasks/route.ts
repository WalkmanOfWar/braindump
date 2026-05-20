import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TaskCreateInput } from "@/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const done = searchParams.get("done");

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      ...(categoryId ? { categoryId } : {}),
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

  const body = (await req.json()) as TaskCreateInput;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: body.title.trim(),
      description: body.description,
      deadline: body.deadline ? new Date(body.deadline) : null,
      priority: body.priority ?? 3,
      tags: body.tags ?? [],
      categoryId: body.categoryId ?? null,
      userId: session.user.id,
    },
    include: { category: true },
  });

  return NextResponse.json(task, { status: 201 });
}
