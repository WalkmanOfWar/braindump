"use client";

import { useState, useEffect } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { CheckCircle2, Flame, BookOpen, AlertTriangle, TrendingUp, Calendar, Clock, Download, AlertCircle, ListTodo, Sparkles, Loader2, RefreshCw, Lightbulb, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WeeklyStats = {
  completed: number;
  missed: number;
  sessions: number;
  studyHours: number;
  active: number;
};

type StatsData = {
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  overdueCount: number;
  streak: number;
  totalStudyHours: number;
  completedPerDay: { date: string; count: number }[];
  priorityDist: { priority: number; count: number }[];
  categoryBreakdown: { name: string; color: string; total: number; done: number }[];
  dayOfWeekDist: { day: string; count: number }[];
  hourOfDayDist: { hour: number; count: number }[];
  bestDay: string | null;
  bestHour: number | null;
  avgPerDay: number;
  // Phase 5
  planningByCategory: { name: string; color: string; estimatedMin: number; actualMin: number; count: number }[];
  deviationHistogram: { label: string; count: number }[];
  planningFallacyTotal: number;
  planningFallacyAvgBias: number | null;
  energyTrend: { date: string; completed: number; energy: number | null }[];
};

type FlashcardStats = {
  retentionRate: number;
  totalCards: number;
  matureCount: number;
  learningVelocity: { date: string; count: number }[];
  deckStats: { id: string; title: string; emoji: string; color: string; total: number; mature: number; avgStability: number }[];
};

type ConfidenceStats = {
  exams: {
    id: string;
    title: string;
    topics: { topic: string; entries: { date: string; confidence: number }[] }[];
  }[];
};

const PRIORITY_LABEL: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5" };
const CONFIDENCE_COLOR = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"] as const;

function StatCard({
  icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  iconClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", iconClass)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats | null>(null);
  const [confidenceStats, setConfidenceStats] = useState<ConfidenceStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/stats/flashcards").then((r) => r.ok ? r.json() : null),
      fetch("/api/stats/confidence").then((r) => r.ok ? r.json() : null),
    ]).then(([statsData, fcData, confData]) => {
      setData(statsData);
      setFlashcardStats(fcData);
      setConfidenceStats(confData);
      setLoading(false);
    });
  }, []);

  const weekLabel = (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const fmt = (d: Date) => d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  const handleWeeklyReview = async () => {
    setWeeklyLoading(true);
    try {
      const res = await fetch("/api/ai/weekly-review", { method: "POST" });
      const json = await res.json();
      if (res.status === 503) {
        toast.error("Brak klucza ANTHROPIC_API_KEY");
        return;
      }
      if (!res.ok) { toast.error(json.error ?? "Błąd generowania przeglądu"); return; }
      setWeeklyStats(json.stats);
      setWeeklyReview(json.review);
    } catch {
      toast.error("Błąd połączenia — spróbuj ponownie");
    } finally {
      setWeeklyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <TopNavbar />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-foreground">Statystyki</h1>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href="/api/export" download>
              <Download className="w-4 h-4" />
              Eksportuj moje dane
            </a>
          </Button>
        </div>

        {loading || !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                iconClass="bg-urgency-low/15 text-urgency-low"
                label="Ukończone zadania"
                value={`${data.doneTasks} / ${data.totalTasks}`}
                sub={`${data.completionRate}% ukończonych`}
              />
              <StatCard
                icon={<Flame className="h-5 w-5" />}
                iconClass="bg-orange-500/15 text-orange-500"
                label="Passa"
                value={`${data.streak} dni`}
                sub="z rzędu"
              />
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                iconClass="bg-accent/15 text-accent"
                label="Godziny nauki"
                value={`${data.totalStudyHours}h`}
                sub="łącznie"
              />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5" />}
                iconClass="bg-destructive/15 text-destructive"
                label="Po terminie"
                value={data.overdueCount}
                sub="aktywnych zadań"
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                iconClass="bg-primary/15 text-primary"
                label="Ukończono (30 dni)"
                value={data.completedPerDay.reduce((s, d) => s + d.count, 0)}
                sub={`śr. ${data.avgPerDay}/dzień`}
              />
              {data.bestDay && (
                <StatCard
                  icon={<Calendar className="h-5 w-5" />}
                  iconClass="bg-emerald-500/15 text-emerald-500"
                  label="Najlepszy dzień"
                  value={data.bestDay}
                  sub="najwięcej zadań"
                />
              )}
              {data.bestHour !== null && (
                <StatCard
                  icon={<Clock className="h-5 w-5" />}
                  iconClass="bg-purple-500/15 text-purple-500"
                  label="Najlepsza godzina"
                  value={`${String(data.bestHour).padStart(2, "0")}:00`}
                  sub="szczyt produktywności"
                />
              )}
            </div>

            {/* Completed per day line chart (trend) */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">Trend ukończonych zadań — ostatnie 30 dni</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.completedPerDay} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval={4}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [`${v ?? 0} zadań`, ""]}
                    labelFormatter={(l: unknown) => formatDate(String(l))}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "var(--primary)" }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 5.4 Energy vs productivity trend */}
            {data.energyTrend.some((d) => d.energy !== null) && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-foreground mb-1">
                  Energia vs ukończone zadania — ostatnie 30 dni
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Sprawdź czy wysoka energia koreluje z większą produktywnością
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.energyTrend} margin={{ left: 0, right: 28, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      interval={4}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="tasks"
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={22}
                    />
                    <YAxis
                      yAxisId="energy"
                      orientation="right"
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={22}
                    />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) =>
                        name === "energy"
                          ? [`${v ?? "–"}/5`, "Energia"]
                          : [`${v ?? 0}`, "Zadania"]
                      }
                      labelFormatter={(l: unknown) => formatDate(String(l))}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      yAxisId="tasks"
                      type="monotone"
                      dataKey="completed"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: "var(--primary)" }}
                      activeDot={{ r: 4 }}
                      name="tasks"
                    />
                    <Line
                      yAxisId="energy"
                      type="monotone"
                      dataKey="energy"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: "#f59e0b" }}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                      name="energy"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Zadania</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" /> Energia (1–5)</span>
                </div>
              </div>
            )}

            {/* Day of week + Hour of day */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-foreground mb-4">Według dnia tygodnia</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.dayOfWeekDist} barSize={28}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      formatter={(v: unknown) => [`${v ?? 0} zadań`, ""]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.dayOfWeekDist.map((d, i) => {
                        const max = Math.max(...data.dayOfWeekDist.map(x => x.count));
                        return (
                          <Cell
                            key={i}
                            fill={d.count === max && max > 0 ? "var(--primary)" : "var(--muted-foreground)"}
                            fillOpacity={d.count === max && max > 0 ? 1 : 0.5}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-foreground mb-4">Według godziny dnia</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.hourOfDayDist} barSize={6}>
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}h`}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      interval={2}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      formatter={(v: unknown) => [`${v ?? 0} zadań`, ""]}
                      labelFormatter={(h: unknown) => `${String(h).padStart(2, "0")}:00`}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {data.hourOfDayDist.map((d, i) => {
                        const max = Math.max(...data.hourOfDayDist.map(x => x.count));
                        return (
                          <Cell
                            key={i}
                            fill={d.count === max && max > 0 ? "var(--primary)" : "var(--muted-foreground)"}
                            fillOpacity={d.count === max && max > 0 ? 1 : 0.5}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Priority distribution */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="text-sm font-semibold text-foreground mb-4">Rozkład priorytetów</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.priorityDist} barSize={28}>
                    <XAxis
                      dataKey="priority"
                      tickFormatter={(v) => PRIORITY_LABEL[v]}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      formatter={(v: unknown) => [`${v ?? 0} zadań`, ""]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.priorityDist.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i >= 3
                              ? "var(--destructive)"
                              : i === 2
                                ? "var(--primary)"
                                : "var(--muted-foreground)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category pie */}
              {data.categoryBreakdown.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-4">Zadania wg kategorii</h2>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.categoryBreakdown}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        innerRadius={35}
                      >
                        {data.categoryBreakdown.map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown, name: unknown) => [`${v ?? 0} zadań`, String(name)]}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Category completion table */}
            {data.categoryBreakdown.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Ukończenie wg kategorii</h2>
                </div>
                <div className="divide-y divide-border">
                  {data.categoryBreakdown.map((c) => {
                    const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                    return (
                      <div key={c.name} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-sm flex-1 text-foreground">{c.name}</span>
                        <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {c.done}/{c.total} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* 5.1 Planning Fallacy */}
            {data.planningFallacyTotal > 0 && (
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Błąd planowania — Planning Fallacy
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kahneman (1979): ludzie systematycznie zaniżają czas zadań
                    </p>
                  </div>
                  {data.planningFallacyAvgBias !== null && (
                    <div className={cn(
                      "shrink-0 text-right",
                      data.planningFallacyAvgBias > 20 ? "text-destructive" : data.planningFallacyAvgBias < -20 ? "text-blue-500" : "text-urgency-low"
                    )}>
                      <p className="text-2xl font-bold leading-tight">
                        {data.planningFallacyAvgBias > 0 ? "+" : ""}{data.planningFallacyAvgBias}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.planningFallacyAvgBias > 0 ? "zajmuje dłużej" : "zajmuje krócej"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Deviation histogram */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3">
                    Rozkład odchyleń (rzeczywisty czas vs planowany) · {data.planningFallacyTotal} zadań
                  </h3>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={data.deviationHistogram} barSize={36} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        formatter={(v: unknown) => [`${v ?? 0} zadań`, ""]}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.deviationHistogram.map((d, i) => (
                          <Cell
                            key={i}
                            fill={
                              i < 2 ? "var(--primary)" :       // finished faster
                              i === 2 ? "#10b981" :             // slightly under
                              i === 3 ? "#f59e0b" :             // slightly over
                              "var(--destructive)"              // took much longer
                            }
                            fillOpacity={d.count === 0 ? 0.2 : 0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-primary inline-block opacity-85" />Szybciej</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-green-500 inline-block opacity-85" />OK</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-destructive inline-block opacity-85" />Dłużej</span>
                  </div>
                </div>

                {/* Per-category breakdown */}
                {data.planningByCategory.length > 0 && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-xs font-medium text-muted-foreground">Odchylenie wg kategorii</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {data.planningByCategory.map((c) => {
                        const bias = c.estimatedMin > 0
                          ? Math.round(((c.actualMin - c.estimatedMin) / c.estimatedMin) * 100)
                          : 0;
                        return (
                          <div key={c.name} className="px-4 py-3 flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="text-sm flex-1 text-foreground">{c.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {Math.round(c.estimatedMin / 60 * 10) / 10}h est → {Math.round(c.actualMin / 60 * 10) / 10}h real
                            </span>
                            <span className={cn(
                              "text-xs font-semibold w-14 text-right shrink-0",
                              bias > 20 ? "text-destructive" : bias < -20 ? "text-blue-500" : "text-urgency-low"
                            )}>
                              {bias > 0 ? "+" : ""}{bias}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Fiszki — analityka ── */}
        {flashcardStats && flashcardStats.totalCards > 0 && (
          <div className="border-t border-border pt-8 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Fiszki — analityka
            </h2>

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                iconClass="bg-green-500/15 text-green-600"
                label="Retencja (30 dni)"
                value={`${flashcardStats.retentionRate}%`}
                sub="ocen Good lub Easy"
              />
              <StatCard
                icon={<Lightbulb className="h-5 w-5" />}
                iconClass="bg-accent/15 text-accent"
                label="Dojrzałe karty"
                value={flashcardStats.matureCount}
                sub={`z ${flashcardStats.totalCards} łącznie`}
              />
            </div>

            {/* Velocity chart */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Aktywność powtórek — ostatnie 14 dni</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={flashcardStats.learningVelocity} barSize={14}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => { const dt = new Date(d); return `${dt.getDate()}.${dt.getMonth() + 1}`; }}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval={1}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    formatter={(v: unknown) => [`${v ?? 0} powtórek`, ""]}
                    labelFormatter={(d: unknown) => { const dt = new Date(String(d)); return `${dt.getDate()}.${dt.getMonth() + 1}`; }}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Deck table */}
            {flashcardStats.deckStats.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Talie</h3>
                </div>
                <div className="divide-y divide-border">
                  {flashcardStats.deckStats.map((deck) => {
                    const pct = deck.total > 0 ? Math.round((deck.mature / deck.total) * 100) : 0;
                    return (
                      <div key={deck.id} className="px-4 py-3 flex items-center gap-3">
                        <span className="text-base">{deck.emoji}</span>
                        <span className="text-sm flex-1 text-foreground truncate">{deck.title}</span>
                        <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: deck.color }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                          {deck.mature}/{deck.total} doj. · ∅{deck.avgStability}d
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pewność per egzamin ── */}
        {confidenceStats && confidenceStats.exams.length > 0 && (
          <div className="border-t border-border pt-8 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Mapa pewności — egzaminy
            </h2>

            <div className="space-y-4">
              {confidenceStats.exams.map((exam) => (
                <div key={exam.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">{exam.title}</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {exam.topics.map(({ topic, entries }) => {
                      const avg = entries.reduce((s, e) => s + e.confidence, 0) / entries.length;
                      return (
                        <div key={topic} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{topic}</span>
                          <div className="flex gap-1 flex-1 min-w-0 flex-wrap">
                            {entries.map((entry, i) => (
                              <span
                                key={i}
                                title={`${entry.date}: ${entry.confidence}/5`}
                                className={cn("inline-block w-4 h-4 rounded-sm shrink-0", CONFIDENCE_COLOR[entry.confidence])}
                              />
                            ))}
                          </div>
                          <span className={cn(
                            "text-xs font-medium shrink-0 w-10 text-right",
                            avg <= 2 ? "text-red-500" : avg < 4 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
                          )}>
                            ∅{Math.round(avg * 10) / 10}/5
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Skala pewności:</span>
                {[1, 2, 3, 4, 5].map((v) => (
                  <span key={v} className="flex items-center gap-1">
                    <span className={cn("inline-block w-3 h-3 rounded-sm", CONFIDENCE_COLOR[v])} />
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Przegląd tygodnia ── */}
        <div className="border-t border-border pt-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Przegląd tygodnia
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{weekLabel}</p>
            </div>
            <Button onClick={handleWeeklyReview} disabled={weeklyLoading} size="sm">
              {weeklyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : weeklyReview ? (
                <><RefreshCw className="h-4 w-4 mr-1.5" />Odśwież</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1.5" />Generuj AI</>
              )}
            </Button>
          </div>

          {weeklyLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          )}

          {!weeklyLoading && weeklyStats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  iconClass="bg-urgency-low/15 text-urgency-low"
                  label="Ukończone"
                  value={weeklyStats.completed}
                  sub="zadań w tym tygodniu"
                />
                <StatCard
                  icon={<AlertCircle className="h-5 w-5" />}
                  iconClass={weeklyStats.missed > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}
                  label="Zaległe"
                  value={weeklyStats.missed}
                  sub="nieukończonych"
                />
                <StatCard
                  icon={<BookOpen className="h-5 w-5" />}
                  iconClass="bg-accent/15 text-accent"
                  label="Sesje nauki"
                  value={weeklyStats.sessions}
                  sub="ukończonych"
                />
                <StatCard
                  icon={<Clock className="h-5 w-5" />}
                  iconClass="bg-primary/15 text-primary"
                  label="Godziny nauki"
                  value={`${weeklyStats.studyHours}h`}
                  sub="łącznie"
                />
                <StatCard
                  icon={<ListTodo className="h-5 w-5" />}
                  iconClass="bg-muted text-muted-foreground"
                  label="Aktywne"
                  value={weeklyStats.active}
                  sub="zadań do zrobienia"
                />
              </div>

              {weeklyStats.completed + weeklyStats.missed > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Skuteczność tygodnia</span>
                    <span className="font-medium text-foreground">
                      {Math.round((weeklyStats.completed / (weeklyStats.completed + weeklyStats.missed)) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-urgency-low rounded-full transition-all"
                      style={{ width: `${Math.round((weeklyStats.completed / (weeklyStats.completed + weeklyStats.missed)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {!weeklyLoading && weeklyReview && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="w-4 h-4" />
                Analiza AI
              </div>
              <p className="text-sm text-foreground leading-relaxed">{weeklyReview}</p>
            </div>
          )}

          {!weeklyLoading && !weeklyStats && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Kliknij „Generuj AI" aby zobaczyć podsumowanie i analizę ostatniego tygodnia.
            </p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
