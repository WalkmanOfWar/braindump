import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WeeklyPlanSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart");

  // If weekStart provided, return that week's plan; otherwise return the current week's plan
  const targetDate = weekStart ? new Date(weekStart) : getThisMonday();

  const plan = await prisma.weeklyPlan.findUnique({
    where: { userId_weekStart: { userId: session.user.id, weekStart: targetDate } },
  });

  return NextResponse.json(plan ?? null);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await req.json();
  const parsed = WeeklyPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Błąd walidacji" }, { status: 400 });
  }

  const { weekStart, priority1, priority2, priority3, notes } = parsed.data;
  const weekStartDate = new Date(weekStart);

  const plan = await prisma.weeklyPlan.upsert({
    where: { userId_weekStart: { userId: session.user.id, weekStart: weekStartDate } },
    update: { priority1, priority2, priority3, notes },
    create: { userId: session.user.id, weekStart: weekStartDate, priority1, priority2, priority3, notes },
  });

  return NextResponse.json(plan);
}

function getThisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // days to subtract to get to Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday;
}
