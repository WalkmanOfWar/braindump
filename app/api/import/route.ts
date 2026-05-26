import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ImportSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    deadline: z.string().nullable().optional(),
    priority: z.number().int().min(1).max(5).optional(),
    done: z.boolean().optional(),
    estimatedMinutes: z.number().int().positive().nullable().optional(),
    recurrence: z.string().optional(),
    subtasks: z.unknown().optional(),
  })).optional(),
  categories: z.array(z.object({
    name: z.string(),
    color: z.string().optional(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const userId = session.user.id;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 }); }

  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 });
  }

  const { tasks = [], categories = [] } = parsed.data;

  const counts = { tasks: 0, categories: 0 };

  // Categories first — needed for task category mapping by name
  for (const cat of categories) {
    await prisma.category.create({
      data: { name: cat.name, color: cat.color ?? "#888888", userId },
    });
    counts.categories++;
  }

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        title: task.title,
        description: task.description ?? null,
        deadline: task.deadline ? new Date(task.deadline) : null,
        priority: task.priority ?? 3,
        done: task.done ?? false,
        estimatedMinutes: task.estimatedMinutes ?? null,
        recurrence: task.recurrence ?? "none",
        userId,
      },
    });
    counts.tasks++;
  }

  return NextResponse.json({ imported: counts });
}
