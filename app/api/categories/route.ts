import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CategoryCreateInput } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const body = (await req.json()) as CategoryCreateInput;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nazwa kategorii jest wymagana" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: {
      name: body.name.trim(),
      color: body.color ?? "#888888",
      userId: session.user.id,
    },
  });
  return NextResponse.json(category, { status: 201 });
}
