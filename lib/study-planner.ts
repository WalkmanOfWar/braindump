/** Formats a Date as YYYY-MM-DD using LOCAL time (avoids UTC rollback issue). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generates study sessions from today until 2 days before the exam.
 * @param examDate      - exam date (stored as UTC midnight, keep as-is)
 * @param dailyHours    - hours per session
 * @param topics        - list of topics cycled across days
 * @param todayStr      - today's date as "YYYY-MM-DD" in the user's local timezone
 *                        (sent from the client to avoid server UTC offset issues)
 */
export function generateSessions(
  examDate: Date,
  dailyHours: number,
  topics: string[] = [],
  todayStr?: string
): { date: string; topic: string; hours: number }[] {
  // Use client-supplied date to avoid UTC vs local midnight mismatch.
  const today = todayStr
    ? new Date(todayStr + "T12:00:00") // noon avoids DST/UTC edge cases
    : new Date();
  today.setHours(12, 0, 0, 0);

  // examDate was parsed as UTC midnight — normalise to noon too.
  const exam = new Date(examDate);
  exam.setHours(12, 0, 0, 0);

  // Leave the day before the exam free — sessions go up to 2 days before.
  const daysToSchedule = Math.floor(
    (exam.getTime() - today.getTime()) / 86400000
  ) - 1;

  if (daysToSchedule <= 0) return [];

  return Array.from({ length: daysToSchedule }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date: toLocalDateStr(date),
      topic: topics[i % topics.length] ?? `Powtórka materiału — dzień ${i + 1}`,
      hours: dailyHours,
    };
  });
}
