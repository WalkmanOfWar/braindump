"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { TaskCard } from "@/components/task-card";
import { Badge } from "@/components/ui/badge";
import type { TaskWithCategory, ExamWithSessions } from "@/types";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [tasksRes, examsRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/exams"),
    ]);
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (examsRes.ok) setExams(await examsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleComplete = async (id: string, completed: boolean) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: completed }),
    });
    if (res.ok) {
      const updated: TaskWithCategory = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const todayStr = getTodayStr();
  const todaySessions = exams.flatMap((exam) =>
    exam.studySessions.filter(
      (s) => new Date(s.date).toISOString().split("T")[0] === todayStr
    ).map((s) => ({ ...s, examTitle: exam.title }))
  );

  const top3 = tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const dA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const dB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (dA !== dB) return dA - dB;
      return b.priority - a.priority;
    })
    .slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Dziś zacznij od tego
          </h2>
          {top3.length > 0 ? (
            <div className="space-y-3">
              {top3.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={{
                    id: task.id,
                    title: task.title,
                    description: task.description ?? undefined,
                    deadline: task.deadline ? new Date(task.deadline) : new Date(),
                    priority: task.priority,
                    categoryId: task.categoryId ?? "osobiste",
                    tags: task.tags,
                    completed: task.done,
                    syncWithGoogle: !!task.googleEventId,
                  }}
                  variant={index === 0 ? "highlighted" : "default"}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Brak aktywnych zadań — świetna robota!</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Sesje nauki na dziś
          </h2>
          {todaySessions.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full shrink-0 border border-border"
                >
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {session.examTitle
                      .replace("Egzamin z ", "")
                      .replace("Certyfikat ", "")}
                  </span>
                  <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 px-2 py-0.5 text-xs">
                    {session.hours}h
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Brak sesji nauki na dziś</p>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
