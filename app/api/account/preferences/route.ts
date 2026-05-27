import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PrefsSchema = z.object({
  reminderEnabled: z.boolean().optional(),
  reminderHoursBefore: z.number().int().refine((v) => [1, 2, 6, 24, 48].includes(v)).optional(),
});

export async function GET() {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { reminderEnabled: true, reminderHoursBefore: true },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const auth = await getServerSession(authOptions);
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const parsed = PrefsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: parsed.data,
    select: { reminderEnabled: true, reminderHoursBefore: true },
  });

  return NextResponse.json(user);
}
