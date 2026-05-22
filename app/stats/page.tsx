"use client";

import { useState, useEffect } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { CheckCircle2, Flame, BookOpen, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
};

const PRIORITY_LABEL: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5" };

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

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <TopNavbar />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Statystyki</h1>

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
                sub="zadań"
              />
            </div>

            {/* Completed per day bar chart */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">Ukończone zadania — ostatnie 30 dni</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.completedPerDay} barSize={6}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval={4}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [`${v} zadań`, ""]}
                    labelFormatter={(l) => formatDate(l as string)}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
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
                      formatter={(v: number) => [`${v} zadań`, ""]}
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
                        formatter={(v: number, name: string) => [`${v} zadań`, name]}
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
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
