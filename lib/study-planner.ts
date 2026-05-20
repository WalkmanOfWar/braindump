export function generateSessions(
  examDate: Date,
  dailyHours: number,
  topics: string[] = []
): { date: string; topic: string; hours: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor(
    (examDate.getTime() - today.getTime()) / 86400000
  );
  if (daysLeft <= 0) return [];

  return Array.from({ length: daysLeft }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date: date.toISOString().split("T")[0],
      topic:
        topics[i % topics.length] ?? `Powtórka materiału — dzień ${i + 1}`,
      hours: dailyHours,
    };
  });
}
