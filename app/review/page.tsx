"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Clock,
  ListTodo,
  Sparkles,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

interface WeeklyStats {
  completed: number;
  missed: number;
  sessions: number;
  studyHours: number;
  active: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function ReviewPage() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const weekLabel = (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const fmt = (d: Date) =>
      d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/weekly-review", { method: "POST" });
      const data = await res.json();

      if (res.status === 503) {
        toast.error("Brak klucza ANTHROPIC_API_KEY — dodaj go do zmiennych środowiskowych");
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? "Błąd generowania przeglądu");
        return;
      }

      setStats(data.stats);
      setReview(data.review);
    } catch {
      toast.error("Błąd połączenia — spróbuj ponownie");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Przegląd tygodnia</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{weekLabel}</p>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : review ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Odśwież
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generuj
              </>
            )}
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-32 rounded-xl" />
          </>
        )}

        {/* Stats */}
        {!loading && stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={CheckCircle2}
                label="Ukończone"
                value={stats.completed}
                sub="zadań w tym tygodniu"
                colorClass="text-urgency-low"
              />
              <StatCard
                icon={AlertCircle}
                label="Zaległe"
                value={stats.missed}
                sub="nieukończonych zadań"
                colorClass={stats.missed > 0 ? "text-destructive" : "text-muted-foreground"}
              />
              <StatCard
                icon={BookOpen}
                label="Sesje nauki"
                value={stats.sessions}
                sub="ukończonych"
                colorClass="text-accent"
              />
              <StatCard
                icon={Clock}
                label="Godziny nauki"
                value={`${stats.studyHours}h`}
                sub="łącznie"
                colorClass="text-primary"
              />
              <StatCard
                icon={ListTodo}
                label="Aktywne"
                value={stats.active}
                sub="zadań do zrobienia"
                colorClass="text-muted-foreground"
              />
            </div>

            {/* Score bar */}
            {stats.completed + stats.missed > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Skuteczność tygodnia</span>
                  <span className="font-medium text-foreground">
                    {Math.round(
                      (stats.completed / (stats.completed + stats.missed)) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-urgency-low rounded-full transition-all"
                    style={{
                      width: `${Math.round(
                        (stats.completed / (stats.completed + stats.missed)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* AI Review */}
        {!loading && review && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="w-4 h-4" />
              Analiza AI
            </div>
            <p className="text-sm text-foreground leading-relaxed">{review}</p>
          </div>
        )}

        {/* Empty / initial state */}
        {!loading && !stats && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-primary/60" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                Gotowy na podsumowanie tygodnia?
              </h3>
              <p className="text-sm text-muted-foreground">
                Kliknij „Generuj" aby zobaczyć statystyki i otrzymać spersonalizowaną analizę od AI.
              </p>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
