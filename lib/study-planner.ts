/** Milliseconds in one day — used for day-difference arithmetic. */
const MS_PER_DAY = 86_400_000 as const;

/** Hour set on all Date objects to avoid DST / UTC midnight edge cases. */
const NOON_HOUR = 12 as const;

/** Sessions stop this many days before the exam (day before = buffer day). */
const DAYS_BUFFER_BEFORE_EXAM = 1 as const;

/** Formats a Date as YYYY-MM-DD using LOCAL time (avoids UTC rollback issue). */
function toLocalDateStr(d: Date): string {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day   = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Assigns a topic for session day `i` out of `total` days.
 * - Block mode (default): groups consecutive days per topic (A→A→B→B→C→C)
 * - Interleaved mode: cycles through topics each day (A→B→C→A→B→C)
 */
function assignTopic(i: number, total: number, topics: string[], interleaved: boolean): string {
  if (topics.length === 0) return `Powtórka materiału — dzień ${i + 1}`;
  if (interleaved) return topics[i % topics.length];
  const blockSize = Math.ceil(total / topics.length);
  return topics[Math.min(Math.floor(i / blockSize), topics.length - 1)];
}

/**
 * Generates study sessions from today until 2 days before the exam.
 * @param examDate      - exam date (stored as UTC midnight, keep as-is)
 * @param dailyHours    - hours per session
 * @param topics        - list of topics distributed across days
 * @param todayStr      - today's date as "YYYY-MM-DD" in the user's local timezone
 *                        (sent from the client to avoid server UTC offset issues)
 * @param interleaved   - if true, cycle topics (A→B→C→A); otherwise block per topic (A→A→B→B)
 */
export function generateSessions(
  examDate: Date,
  dailyHours: number,
  topics: string[] = [],
  todayStr?: string,
  interleaved = false
): { date: string; topic: string; hours: number }[] {
  // Use client-supplied date to avoid UTC vs local midnight mismatch.
  const today = todayStr
    ? new Date(todayStr + `T${NOON_HOUR}:00:00`) // noon avoids DST/UTC edge cases
    : new Date();
  today.setHours(NOON_HOUR, 0, 0, 0);

  // examDate was parsed as UTC midnight — normalise to noon too.
  const exam = new Date(examDate);
  exam.setHours(NOON_HOUR, 0, 0, 0);

  // Leave the day before the exam free — sessions go up to DAYS_BUFFER_BEFORE_EXAM days before.
  const daysToSchedule =
    Math.floor((exam.getTime() - today.getTime()) / MS_PER_DAY) - DAYS_BUFFER_BEFORE_EXAM;

  if (daysToSchedule <= 0) return [];

  return Array.from({ length: daysToSchedule }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date:  toLocalDateStr(date),
      topic: assignTopic(i, daysToSchedule, topics, interleaved),
      hours: dailyHours,
    };
  });
}
