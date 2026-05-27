import { notFound } from "next/navigation";
import { CheckCircle2, BookOpen, Brain, ListTodo, Layers } from "lucide-react";

interface ShareStats {
  tasksCompletedWeek: number;
  tasksCompletedMonth: number;
  studySessionsWeek: number;
  flashcardReviewsWeek: number;
  totalFlashcards: number;
  activeTasksCount: number;
}

interface ShareData {
  name: string | null;
  image: string | null;
  stats: ShareStats;
}

async function fetchShareData(token: string): Promise<ShareData | null> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/share/${token}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<ShareData>;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShareData(token);
  if (!data) notFound();

  const { name, stats } = data;

  const statCards = [
    {
      icon: CheckCircle2,
      label: "Zadań ukończonych (ten tydzień)",
      value: stats.tasksCompletedWeek,
      color: "text-green-500",
    },
    {
      icon: CheckCircle2,
      label: "Zadań ukończonych (ten miesiąc)",
      value: stats.tasksCompletedMonth,
      color: "text-green-600",
    },
    {
      icon: BookOpen,
      label: "Sesji nauki (ten tydzień)",
      value: stats.studySessionsWeek,
      color: "text-blue-500",
    },
    {
      icon: Brain,
      label: "Powtórek fiszek (ten tydzień)",
      value: stats.flashcardReviewsWeek,
      color: "text-purple-500",
    },
    {
      icon: Layers,
      label: "Fiszek łącznie",
      value: stats.totalFlashcards,
      color: "text-violet-500",
    },
    {
      icon: ListTodo,
      label: "Aktywnych zadań",
      value: stats.activeTasksCount,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-3xl">
            🧠
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {name ? `Postęp: ${name}` : "Publiczne statystyki nauki"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Współdzielone dane o produktywności — Ariely &amp; Wertenbroch (2002)
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1"
            >
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Publiczne zobowiązanie zwiększa dotrzymywanie terminów o ~31%
          (Ariely &amp; Wertenbroch, 2002)
        </p>
      </div>
    </div>
  );
}
