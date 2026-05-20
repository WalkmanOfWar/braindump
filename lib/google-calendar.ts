import { google } from "googleapis";
import { prisma } from "./prisma";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export async function getCalendarClient(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const tokens = user?.googleTokens as GoogleTokens | null;
  if (!tokens?.access_token) {
    throw new Error("Brak tokenów Google dla użytkownika");
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials(tokens);
  return google.calendar({ version: "v3", auth });
}

export async function createCalendarEvent(
  userId: string,
  title: string,
  start: Date,
  end: Date,
  description?: string
): Promise<string | null | undefined> {
  const calendar = await getCalendarClient(userId);
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
  return res.data.id;
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<void> {
  const calendar = await getCalendarClient(userId);
  await calendar.events.delete({ calendarId: "primary", eventId });
}
