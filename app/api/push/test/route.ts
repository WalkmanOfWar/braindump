import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  try {
    await sendPushToUser(session.user.id, {
      title: "🚀 Brain Dump",
      body: "Powiadomienia działają — wszystko gotowe!",
      url: "/dashboard",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/test]", err);
    return NextResponse.json({ error: "Nie udało się wysłać" }, { status: 500 });
  }
}
