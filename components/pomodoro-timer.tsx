"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Phase = "work" | "break";

export interface PomodoroSession {
  examTitle: string;
  topic: string;
}

interface PomodoroContextValue {
  start: (session: PomodoroSession) => void;
  isActive: boolean;
}

const PomodoroContext = createContext<PomodoroContextValue>({
  start: () => {},
  isActive: false,
});

export function usePomodoroTimer() {
  return useContext(PomodoroContext);
}

const WORK_S = 25 * 60;
const BREAK_S = 5 * 60;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [phase, setPhase] = useState<Phase>("work");
  const [seconds, setSeconds] = useState(WORK_S);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!running) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s > 1) return s - 1;

        // Interval finished — switch phase
        clearTimer();
        setRunning(false);
        setPhase((prev) => {
          const next: Phase = prev === "work" ? "break" : "work";
          setSeconds(next === "work" ? WORK_S : BREAK_S);
          toast.info(
            next === "break"
              ? "⏸ Zasłużona przerwa! 5 minut odpoczynku."
              : "▶ Czas pracy! 25 minut skupienia."
          );
          return next;
        });
        return 0;
      });
    }, 1_000);

    return clearTimer;
  }, [running]);

  const start = useCallback((s: PomodoroSession) => {
    setSession(s);
    setPhase("work");
    setSeconds(WORK_S);
    setRunning(true);
  }, []);

  const close = () => {
    clearTimer();
    setSession(null);
    setRunning(false);
  };

  const reset = () => {
    clearTimer();
    setPhase("work");
    setSeconds(WORK_S);
    setRunning(false);
  };

  const total = phase === "work" ? WORK_S : BREAK_S;
  const progress = ((total - seconds) / total) * 100;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <PomodoroContext.Provider value={{ start, isActive: !!session }}>
      {children}

      {session && (
        <div
          role="timer"
          aria-label="Pomodoro"
          className="fixed bottom-20 right-4 md:bottom-6 z-50 w-72 rounded-2xl border border-border bg-card shadow-xl p-4 space-y-3"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium min-w-0">
              <Timer className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-foreground">{session.topic}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {session.examTitle}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={close}
              aria-label="Zamknij timer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Clock */}
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              {phase === "work" ? "Czas pracy" : "Przerwa"}
            </p>
            <p className="text-4xl font-mono font-bold text-foreground tabular-nums">
              {mm}:{ss}
            </p>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="h-1.5" />

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? (
                <Pause className="w-3.5 h-3.5 mr-1" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1" />
              )}
              {running ? "Pauza" : "Wznów"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={reset}
              aria-label="Resetuj"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </PomodoroContext.Provider>
  );
}
