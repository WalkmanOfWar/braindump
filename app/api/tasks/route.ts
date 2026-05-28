import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_CREATED      = 201 as const;
const HTTP_SERVER_ERROR = 500 as const;

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const goalId     = searchParams.get("goalId");
  const done       = searchParams.get("done");

  try {
    const tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        ...(categoryId ? { categoryId } : {}),
        ...(goalId     ? { goalId }     : {}),
        ...(done !== null ? { done: done === "true" } : {}),
      },
      include:  { category: true },
      orderBy:  [{ priority: "desc" }, { deadline: "asc" }],
    });
    return NextResponse.json(tasks);
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  const parsed = TaskCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const {
    title, description, deadline, priority, categoryId, goalId,
    estimatedMinutes, recurrence, recurrenceEnd, subtasks,
    intentionWhen, intentionWhere, isUrgent, isImportant, energyLevel,
  } = parsed.data;

  try {
    const task = await prisma.task.create({
      data: {
        title:            title.trim(),
        description,
        deadline:         deadline ? new Date(deadline) : null,
        priority,
        categoryId:       categoryId       ?? null,
        goalId:           goalId           ?? null,
        estimatedMinutes: estimatedMinutes ?? null,
        intentionWhen:    intentionWhen    ?? null,
        intentionWhere:   intentionWhere   ?? null,
        isUrgent:         isUrgent         ?? false,
        isImportant:      isImportant      ?? false,
        energyLevel:      energyLevel      ?? null,
        userId:           session.user.id,
        recurrence:       recurrence       ?? "none",
        recurrenceEnd:    recurrenceEnd ? new Date(recurrenceEnd) : null,
        subtasks:         subtasks         ?? undefined,
      },
      include: { category: true },
    });
    return NextResponse.json(task, { status: HTTP_CREATED });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
