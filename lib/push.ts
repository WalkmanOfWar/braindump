import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/** Initialise VAPID lazily so missing env vars crash at call-time, not at module load (build-time). */
function getWebPush() {
  webpush.setVapidDetails(
    `mailto:${process.env.SMTP_USER ?? "admin@braindump.app"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return webpush;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });

  await Promise.allSettled(
    subs.map((sub) =>
      getWebPush().sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
}
