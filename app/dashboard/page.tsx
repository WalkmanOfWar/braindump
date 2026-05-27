"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { TaskCard } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, ListTodo, BookOpen, Loader2, RefreshCw, Play, Target, Timer, Lightbulb, CalendarDays } from "lucide-react";
import { useFocusMode } from "@/components/focus-mode";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { Button } from "@/components/ui/button";
import { WeeklyPlanModal } from "@/components/weekly-plan-modal";
import { EnergyCheckInModal, useEnergyCheckIn } from "@/components/energy-checkin-modal";
import { CognitiveLoadBanner } from "@/components/cognitive-load-banner";
import { useCalendarSync } from "@/hooks/use-calendar-sync";
import { useDeadlineReminders } from "@/hooks/use-deadline-reminders";
import { usePomodoroTimer } from "@/components/pomodoro-timer";
import { getTodayStr, toUiTask } from "@/lib/utils";
import type { TaskWithCategory, ExamWithSessions, Category, UiTask } from "@/types";

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [editingTask, setEditingTask] = useState<UiTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dueFlashcards, setDueFlashcards] = useState(0);
  const [focusRec, setFocusRec] = useState<{ taskId: string; title: string; estimatedMinutes: number | null; reason: string } | null>(null);
  const [focusRecLoading, setFocusRecLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [weeklyPlanOpen, setWeeklyPlanOpen] = useState(false);
  const { open: energyOpen, setOpen: setEnergyOpen, todayLevel, handleCheckedIn } = useEnergyCheckIn();
  const { startFocus } = useFocusMode();

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, examsRes, catsRes, flashcardsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/exams"),
        fetch("/api/categories"),
        fetch("/api/flashcards?dueOnly=true"),
      ]);
      if (!tasksRes.ok || !examsRes.ok || !catsRes.ok) throw new Error();
      const fetchedTasks = await tasksRes.json();
      setTasks(fetchedTasks);
      setExams(await examsRes.json());
      setCategories(await catsRes.json());
      if (flashcardsRes.ok) {
        const fc = await flashcardsRes.json() as { dueCount: number };
        setDueFlashcards(fc.dueCount);
      }
      // Show onboarding for brand-new users who have no tasks and haven't dismissed it
      if (fetchedTasks.length === 0 && !localStorage.getItem("onboarding-done")) {
        setShowOnboarding(true);
      }
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFetchFocusRec = async () => {
    setFocusRecLoading(true);
    try {
      const res = await fetch("/api/ai/focus-recommendation", { method: "POST" });
      const data = await res.json();
      if (res.ok) setFocusRec(data);
      else toast.error(data.error ?? "Nie udało się pobrać rekomendacji");
    } catch {
      toast.error("Błąd połączenia z AI");
    } finally {
      setFocusRecLoading(false);
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean, actualMinutes?: number) => {
    const body: Record<string, unknown> = { done: completed };
    if (completed && actualMinutes != null) body.actualMinutes = actualMinutes;
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  useDeadlineReminders(tasks);
  const { start: startPomodoro } = usePomodoroTimer();

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

        {/* Cognitive Load Monitor (Miller's Law) */}
        <CognitiveLoadBanner activeTaskCount={activeTasks} />

        {/* Co teraz? */}
        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Target className="w-4 h-4 text-primary" />
              Co teraz?
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={handleFetchFocusRec}
              disabled={focusRecLoading}
            >
              {focusRecLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : focusRec ? <RefreshCw className="w-3.5 h-3.5" /> : "Zapytaj AI"}
            </Button>
          </div>
          {focusRec ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">{focusRec.reason}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{focusRec.title}</span>
                {focusRec.estimatedMinutes && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    ~{focusRec.estimatedMinutes < 60 ? `${focusRec.estimatedMinutes} min` : `${Math.round(focusRec.estimatedMinutes / 60)}h`}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => {
                  const task = tasks.find((t) => t.id === focusRec.taskId);
                  if (task) startFocus(task);
                }}
              >
                <Target className="w-3.5 h-3.5" />
                Rozpocznij fokus
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {focusRecLoading ? "AI analizuje Twoje zadania..." : "Kliknij \"Zapytaj AI\" - dostaniesz konkretna rekomendacje co zrobic teraz i dlaczego."}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Aktywne</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{activeTasks}</p>
            <p className="text-xs text-muted-foreground">zadań do zrobienia</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-urgency-low" />
              <span className="text-xs text-muted-foreground">Dziś</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{doneTodayTasks}</p>
            <p className="text-xs text-muted-foreground">ukończonych</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">Nauka</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {doneSessionsToday}/{todaySessions.length}
            </p>
            <p className="text-xs text-muted-foreground">sesji dziś</p>
          </div>
          <a href="/flashcards" className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Fiszki</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{dueFlashcards}</p>
            <p className="text-xs text-muted-foreground">do powtórki dziś</p>
          </a>
          <button
            onClick={() => setEnergyOpen(true)}
            className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">
                {todayLevel === 1 ? '😴' : todayLevel === 2 ? '😪' : todayLevel === 3 ? '😐' : todayLevel === 4 ? '😊' : todayLevel === 5 ? '🚀' : '⚡'}
              </span>
              <span className="text-xs text-muted-foreground">Energia</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{todayLevel ?? '–'}</p>
            <p className="text-xs text-muted-foreground">{todayLevel ? 'dziś' : 'zaznacz'}</p>
          </button>
        </div>

        {/* Weekly Planning CTA */}
        <button
          onClick={() => setWeeklyPlanOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors text-left"
        >
          <CalendarDays className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Plan tygodnia</p>
            <p className="text-xs text-muted-foreground">Top 3 priorytety · Newport &amp; GTD</p>
          </div>
          <span className="ml-auto text-xs text-primary font-medium">Otwórz →</span>
        </button>

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
                  onSyncCalendar={handleSyncCalendar}
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

      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => {
            localStorage.setItem("onboarding-done", "1");
            setShowOnboarding(false);
            fetchData();
          }}
        />
      )}

      <WeeklyPlanModal open={weeklyPlanOpen} onOpenChange={setWeeklyPlanOpen} />
      <EnergyCheckInModal open={energyOpen} onOpenChange={setEnergyOpen} onCheckedIn={handleCheckedIn} />
    </div>
  );
}
