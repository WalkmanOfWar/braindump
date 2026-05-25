"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { TaskCard } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Sun,
  AlarmClock,
  BookOpen,
  ListTodo,
  Plus,
  ChevronRight,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useCalendarSync } from "@/hooks/use-calendar-sync";
import { useDeadlineReminders } from "@/hooks/use-deadline-reminders";
import { usePomodoroTimer } from "@/components/pomodoro-timer";
import { getTodayStr, getDateStr, toUiTask } from "@/lib/utils";
import type { TaskWithCategory, ExamWithSessions, Category, UiTask } from "@/types";

export default function TodayPage() {
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

  const todayStr = getTodayStr();

  // tomorrowStr: use setDate arithmetic — safe across DST transitions
  const tomorrowStr = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toLocaleDateString("sv-SE");
  }, []);

  const overdueTasks = useMemo(
    () => tasks.filter((t) => !t.done && !!t.deadline && getDateStr(t.deadline) < todayStr),
    [tasks, todayStr]
  );

  const todayTasks = useMemo(
    () => tasks.filter((t) => !t.done && !!t.deadline && getDateStr(t.deadline) === todayStr),
    [tasks, todayStr]
  );

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (t.done || !t.deadline) return false;
          const ds = getDateStr(t.deadline);
          return ds > todayStr && ds <= tomorrowStr;
        })
        .slice(0, 3),
    [tasks, todayStr, tomorrowStr]
  );

  const todaySessions = useMemo(
    () =>
      exams.flatMap((exam) =>
        exam.studySessions
          .filter((s) => getDateStr(s.date) === todayStr)
          .map((s) => ({ ...s, examId: exam.id, examTitle: exam.title }))
      ),
    [exams, todayStr]
  );

  // Nothing left for today: no overdue, no today tasks, and no pending sessions
  const nothingScheduled =
    overdueTasks.length === 0 &&
    todayTasks.length === 0 &&
    todaySessions.length === 0;

  const allDone =
    nothingScheduled || todaySessions.every((s) => s.done);

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

  const handleSyncCalendar = useCalendarSync(setTasks);

  useDeadlineReminders(tasks);
  const { start: startPomodoro } = usePomodoroTimer();

  const handleSave = async (taskData: Partial<UiTask>) => {
    const body = JSON.stringify({
      title: taskData.title,
      description: taskData.description,
      deadline: taskData.deadline?.toISOString(),
      priority: taskData.priority,
      categoryId: taskData.categoryId || null,
      goalId: taskData.goalId ?? null,
      recurrence: taskData.recurrence,
      recurrenceEnd: taskData.recurrenceEnd?.toISOString(),
      subtasks: taskData.subtasks,
      estimatedMinutes: taskData.estimatedMinutes ?? null,
    });

    if (taskData.id) {
      const res = await fetch(`/api/tasks/${taskData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        const updated: TaskWithCategory = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskData.id ? updated : t)));
        toast.success("Zadanie zaktualizowane");
      } else {
        toast.error("Nie udało się zaktualizować zadania");
      }
    } else {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        const created: TaskWithCategory = await res.json();
        setTasks((prev) => [...prev, created]);
        toast.success("Zadanie dodane!");
      } else {
        toast.error("Nie udało się dodać zadania");
      }
    }
    setEditingTask(null);
  };

  const todayFormatted = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-6">
        <TopNavbar />
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-6">
        <TopNavbar />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Nie udało się załadować danych.{" "}
              <button
                onClick={() => {
                  setIsError(false);
                  setIsLoading(true);
                  fetchData();
                }}
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

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="h-5 w-5 text-amber-500" />
              <h1 className="text-2xl font-bold text-foreground capitalize">
                {todayFormatted}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {allDone && nothingScheduled
                ? "Brak zadań ani sesji na dziś"
                : allDone
                ? "Wszystko gotowe — super robota!"
                : `${overdueTasks.length + todayTasks.length} ${overdueTasks.length + todayTasks.length === 1 ? "zadanie" : "zadań"} na dziś`}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              setEditingTask(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nowe
          </Button>
        </div>

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlarmClock className="h-4 w-4 text-destructive" />
              <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">
                Przeterminowane
              </h2>
              <Badge variant="destructive" className="ml-auto text-xs">
                {overdueTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={toUiTask(task)}
                  categoryOverride={task.category ?? null}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSyncCalendar={handleSyncCalendar}
                />
              ))}
            </div>
          </section>
        )}

        {/* Today's tasks */}
        {todayTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ListTodo className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Na dziś
              </h2>
              <Badge variant="secondary" className="ml-auto text-xs">
                {todayTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={toUiTask(task)}
                  categoryOverride={task.category ?? null}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSyncCalendar={handleSyncCalendar}
                />
              ))}
            </div>
          </section>
        )}

        {/* Today's study sessions */}
        {todaySessions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Nauka dziś
              </h2>
              <Badge variant="secondary" className="ml-auto text-xs">
                {todaySessions.filter((s) => s.done).length}/{todaySessions.length}
              </Badge>
            </div>
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
                    <p
                      className={`text-sm font-medium truncate ${
                        session.done
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {session.topic}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-md bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium shrink-0">
                    {session.hours}h
                  </span>
                  {!session.done && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0 text-primary hover:text-primary"
                      onClick={() =>
                        startPomodoro({ examTitle: session.examTitle, topic: session.topic })
                      }
                      aria-label="Rozpocznij Pomodoro"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {nothingScheduled && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
              <Sun className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Nic zaplanowanego</h3>
            <p className="text-sm text-muted-foreground">
              Brak zadań ani sesji na dziś. Czas odpocząć albo zaplanować coś nowego!
            </p>
          </div>
        )}

        {/* Upcoming tomorrow */}
        {upcomingTasks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Jutro
            </h2>
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={toUiTask(task)}
                  categoryOverride={task.category ?? null}
                  onToggleComplete={handleToggleComplete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSyncCalendar={handleSyncCalendar}
                />
              ))}
            </div>
          </section>
        )}

        {/* Link to full list */}
        <div className="flex items-center justify-center pt-2">
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Wszystkie zadania
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
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
