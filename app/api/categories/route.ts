import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryCreateSchema } from "@/lib/schemas";

const HTTP_UNAUTHORIZED = 401 as const;
const HTTP_BAD_REQUEST  = 400 as const;
const HTTP_CREATED      = 201 as const;
const HTTP_SERVER_ERROR = 500 as const;

function serverError(): NextResponse {
  return NextResponse.json({ error: "Wewnętrzny błąd serwera" }, { status: HTTP_SERVER_ERROR });
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: HTTP_UNAUTHORIZED });
  }

  try {
    const categories = await prisma.category.findMany({
      where:   { userId: session.user.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
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

  const parsed = CategoryCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const { name, color } = parsed.data;

  try {
    const category = await prisma.category.create({
      data: {
        name:   name.trim(),
        color,
        userId: session.user.id,
      },
    });
    return NextResponse.json(category, { status: HTTP_CREATED });
  } catch (error: unknown) {
    console.error(error);
    return serverError();
  }
}
