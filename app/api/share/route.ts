import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

// GET — return current user's shareToken (null if not yet created)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shareToken: true },
  });

  return NextResponse.json({ shareToken: user?.shareToken ?? null });
}

// POST — generate or revoke share token
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string };
  const action = body.action ?? "generate";

  if (action === "revoke") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { shareToken: null },
    });
    return NextResponse.json({ shareToken: null });
  }

  // Generate a new token (or return existing)
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shareToken: true },
  });

  const token = existing?.shareToken ?? nanoid(12);
  if (!existing?.shareToken) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { shareToken: token },
    });
  }

  return NextResponse.json({ shareToken: token });
}
