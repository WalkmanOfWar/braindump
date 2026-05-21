"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { TaskCard } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, ListTodo, BookOpen } from "lucide-react";
import type { TaskWithCategory, ExamWithSessions, Category, UiTask } from "@/types";

function getTodayStr() {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local time
}

function toUiTask(t: TaskWithCategory): UiTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    deadline: t.deadline ? new Date(t.deadline) : new Date(),
    priority: t.priority,
    categoryId: t.categoryId ?? "",
    completed: t.done,
    syncWithGoogle: !!t.googleEventId,
  };
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [editingTask, setEditingTask] = useState<UiTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, examsRes, catsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/exams"),
        fetch("/api/categories"),
      ]);
      if (!tasksRes.ok || !examsRes.ok || !catsRes.ok) throw new Error();
      setTasks(await tasksRes.json());
      setExams(await examsRes.json());
      setCategories(await catsRes.json());
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
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
      toast.success(completed ? "Zadanie ukończone!" : "Zadanie przywrócone");
    } else {
      toast.error("Nie udało się zaktualizować zadania");
    }
  };

  const handleToggleSession = async (examId: string, sessionId: string, done: boolean) => {
    const res = await fetch(`/api/exams/${examId}/sessions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, done }),
    });
    if (res.ok) {
      setExams((prev) =>
        prev.map((exam) => {
          if (exam.id !== examId) return exam;
          return {
            ...exam,
            studySessions: exam.studySessions.map((s) =>
              s.id === sessionId ? { ...s, done } : s
            ),
          };
        })
      );
      toast.success(done ? "Sesja ukończona!" : "Sesja przywrócona");
    } else {
      toast.error("Nie udało się zaktualizować sesji");
    }
  };

  const handleEdit = (task: UiTask) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Zadanie usunięte");
    } else {
      toast.error("Nie udało się usunąć zadania");
    }
  };

  const handleSave = async (taskData: Partial<UiTask>) => {
    if (!taskData.id) return;
    const res = await fetch(`/api/tasks/${taskData.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskData.title,
        description: taskData.description,
        deadline: taskData.deadline?.toISOString(),
        priority: taskData.priority,
        categoryId: taskData.categoryId || null,
      }),
    });
    if (res.ok) {
      const updated: TaskWithCategory = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskData.id ? updated : t)));
      toast.success("Zadanie zaktualizowane");
    } else {
      toast.error("Nie udało się zaktualizować zadania");
    }
    setEditingTask(null);
  };

  const todayStr = getTodayStr();

  const todaySessions = exams.flatMap((exam) =>
    exam.studySessions
      .filter((s) => new Date(s.date).toLocaleDateString("sv-SE") === todayStr)
      .map((s) => ({ ...s, examId: exam.id, examTitle: exam.title }))
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

  // Stats
  const activeTasks = tasks.filter((t) => !t.done).length;
  const doneTodayTasks = tasks.filter((t) => {
    if (!t.done || !t.doneAt) return false;
    return new Date(t.doneAt).toLocaleDateString("sv-SE") === todayStr;
  }).length;
  const doneSessionsToday = todaySessions.filter((s) => s.done).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-6">
        <TopNavbar />
        <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card">
                <Skeleton className="w-4 h-4 rounded mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-6">
        <TopNavbar />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Nie udało się załadować danych.{" "}
              <button
                onClick={() => { setIsError(false); setIsLoading(true); fetchData(); }}
                className="text-primary underline"
              >
                Spróbuj ponownie
              </button>
            </p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListTodo className="h-4 w-4" />
              <span className="text-xs">Aktywne</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{activeTasks}</p>
            <p className="text-xs text-muted-foreground">zadań do zrobienia</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Dziś</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{doneTodayTasks}</p>
            <p className="text-xs text-muted-foreground">zadań ukończonych</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span className="text-xs">Nauka</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {doneSessionsToday}/{todaySessions.length}
            </p>
            <p className="text-xs text-muted-foreground">sesji dziś</p>
          </div>
        </div>

        {/* Top 3 tasks */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Dziś zacznij od tego
          </h2>
          {top3.length > 0 ? (
            <div className="space-y-3">
              {top3.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={toUiTask(task)}
                  categoryOverride={task.category ?? null}
                  variant={index === 0 ? "highlighted" : "default"}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Brak aktywnych zadań — świetna robota!</p>
          )}
        </section>

        {/* Today's study sessions */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Sesje nauki na dziś
          </h2>
          {todaySessions.length > 0 ? (
            <div className="space-y-2">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 px-4 py-3 bg-card rounded-lg border border-border"
                >
                  <Checkbox
                    checked={session.done}
                    onCheckedChange={(checked) =>
                      handleToggleSession(session.examId, session.id, checked as boolean)
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {session.examTitle}
                    </p>
                    <p className={`text-sm font-medium truncate ${session.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {session.topic}
                    </p>
                  </div>
                  <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 px-2 py-0.5 text-xs shrink-0">
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

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        categories={categories}
        onSave={handleSave}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
      />
    </div>
  );
}
