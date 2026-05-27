import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CheckInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: YYYY-MM-DD"),
  level: z.number().int().min(1).max(5),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (date) {
    const checkIn = await prisma.energyCheckIn.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    });
    return NextResponse.json(checkIn ?? null);
  }

  // Return last 30 days for correlation stats
  const checkIns = await prisma.energyCheckIn.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: 30,
  });
  return NextResponse.json(checkIns);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await req.json();
  const parsed = CheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Błąd walidacji" }, { status: 400 });
  }

  const { date, level } = parsed.data;
  const checkIn = await prisma.energyCheckIn.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    update: { level },
    create: { userId: session.user.id, date, level },
  });

  return NextResponse.json(checkIn);
}
