"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { X, CheckCircle2, Timer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TaskWithCategory } from "@/types";

const WORK_S = 25 * 60;
const BREAK_S = 5 * 60;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface FocusModeContextValue {
  startFocus: (task: TaskWithCategory) => void;
  exitFocus: () => void;
  activeTask: TaskWithCategory | null;
}

const FocusModeContext = createContext<FocusModeContextValue>({
  startFocus: () => {},
  exitFocus: () => {},
  activeTask: null,
});

export function useFocusMode() {
  return useContext(FocusModeContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider + Overlay
// ─────────────────────────────────────────────────────────────────────────────

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [activeTask, setActiveTask] = useState<TaskWithCategory | null>(null);
  const [subtasks, setSubtasks] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [completing, setCompleting] = useState(false);
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [timeLeft, setTimeLeft] = useState(WORK_S);
  const [running, setRunning] = useState(false);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("work");
    setTimeLeft(WORK_S);
  }, []);

  const toggle = useCallback(() => setRunning((r) => !r), []);

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Switch phase
          setPhase((p) => {
            const next = p === "work" ? "break" : "work";
            setTimeLeft(next === "work" ? WORK_S : BREAK_S);
            return next;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const startFocus = useCallback((task: TaskWithCategory) => {
    setActiveTask(task);
    setSubtasks(
      Array.isArray(task.subtasks)
        ? (task.subtasks as { id: string; text: string; done: boolean }[])
        : []
    );
    reset();
  }, [reset]);

  const exitFocus = useCallback(() => {
    setActiveTask(null);
    setSubtasks([]);
    reset();
  }, [reset]);

  // Lock body scroll while focus mode is open
  useEffect(() => {
    if (activeTask) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [activeTask]);

  // Escape to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") exitFocus(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [exitFocus]);

  const handleComplete = async () => {
    if (!activeTask || completing) return;
    setCompleting(true);
    const res = await fetch(`/api/tasks/${activeTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    setCompleting(false);
    if (res.ok) {
      toast.success(`✅ Ukończono: „${activeTask.title}"`);
      exitFocus();
    } else {
      toast.error("Nie udało się ukończyć zadania");
    }
  };

  const toggleSubtask = (id: string) => {
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  };

  // Format mm:ss
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");
  const isWork = phase === "work";

  const deadline = activeTask?.deadline
    ? new Date(activeTask.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })
    : null;

  const estMins = (activeTask as (TaskWithCategory & { estimatedMinutes?: number | null }) | null)?.estimatedMinutes;

  return (
    <FocusModeContext.Provider value={{ startFocus, exitFocus, activeTask }}>
      {children}

      {activeTask && (
        <div className="fixed inset-0 z-[100] bg-background/97 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          {/* Exit */}
          <button
            onClick={exitFocus}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Wyjdź z trybu skupienia"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Mode badge */}
          <p className={cn(
            "text-xs font-semibold uppercase tracking-widest mb-6 px-3 py-1 rounded-full",
            isWork ? "bg-primary/10 text-primary" : "bg-urgency-low/10 text-urgency-low"
          )}>
            {isWork ? "🎯 Tryb skupienia" : "☕ Przerwa"}
          </p>

          {/* Task */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center max-w-xl leading-snug mb-2">
            {activeTask.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-8 flex-wrap justify-center">
            {activeTask.category && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${activeTask.category.color}20`,
                  color: activeTask.category.color,
                }}
              >
                {activeTask.category.name}
              </span>
            )}
            {deadline && <span>📅 {deadline}</span>}
            {estMins && (
              <span className="flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                ~{estMins < 60 ? `${estMins} min` : `${Math.round(estMins / 60)}h`}
              </span>
            )}
          </div>

          {/* Timer */}
          <div className={cn(
            "w-44 h-44 rounded-full flex items-center justify-center border-4 mb-8 transition-colors duration-500",
            isWork ? "border-primary" : "border-urgency-low"
          )}>
            <span className={cn(
              "text-5xl font-mono font-bold tabular-nums",
              isWork ? "text-primary" : "text-urgency-low"
            )}>
              {mins}:{secs}
            </span>
          </div>

          {/* Timer controls */}
          <div className="flex items-center gap-3 mb-10">
            <Button
              onClick={toggle}
              size="lg"
              className={cn(
                "min-w-[120px]",
                running ? "variant-outline" : ""
              )}
              variant={running ? "outline" : "default"}
            >
              {running ? "Pauza" : "Start"}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              Reset
            </Button>
          </div>

          {/* Subtasks */}
          {subtasks.length > 0 && (
            <div className="w-full max-w-sm mb-8 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Podzadania</p>
              {subtasks.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSubtask(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors",
                    s.done
                      ? "bg-urgency-low/5 border-urgency-low/20 text-muted-foreground"
                      : "bg-card border-border hover:border-primary/40"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                    s.done ? "border-urgency-low bg-urgency-low/20" : "border-border"
                  )}>
                    {s.done && <CheckCircle2 className="w-3 h-3 text-urgency-low" />}
                  </div>
                  <span className={cn("text-sm", s.done && "line-through")}>{s.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Complete */}
          <Button
            onClick={handleComplete}
            disabled={completing}
            size="lg"
            className="bg-urgency-low hover:bg-urgency-low/90 text-white min-w-[180px] gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {completing ? "Zapisywanie…" : "Ukończ zadanie"}
          </Button>

          <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            Esc — wyjdź bez ukończenia
          </p>
        </div>
      )}
    </FocusModeContext.Provider>
  );
}
