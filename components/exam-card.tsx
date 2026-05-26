"use client";

import { useState } from "react";
import { cn, formatDate, getDaysUntil, getDateStr, getTodayStr } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
  Pencil,
  Play,
  Lightbulb,
  Brain,
  BarChart2,
  Shuffle,
} from "lucide-react";
import type { ExamWithSessions } from "@/types";
import type { StudySession } from "@prisma/client";
import { usePomodoroTimer } from "@/components/pomodoro-timer";
import { SessionRatingModal } from "@/components/session-rating-modal";
import { QuizModal } from "@/components/quiz-modal";
import { toast } from "sonner";

// ─── Confidence helpers ───────────────────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: number | null | undefined }) {
  if (!confidence) return null;
  const color =
    confidence <= 2 ? "bg-red-500"
    : confidence === 3 ? "bg-yellow-500"
    : "bg-green-500";
  return (
    <span
      className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", color)}
      title={`Pewność: ${confidence}/5`}
    />
  );
}

/** Per-topic mini confidence chart shown at the bottom of the expanded section. */
function ConfidenceChart({ sessions }: { sessions: StudySession[] }) {
  const done = sessions.filter((s) => s.done && s.confidence != null);
  if (done.length === 0) return null;

  // Group by topic, keeping insertion order
  const byTopic = new Map<string, number[]>();
  for (const s of done) {
    const arr = byTopic.get(s.topic) ?? [];
    arr.push(s.confidence!);
    byTopic.set(s.topic, arr);
  }

  return (
    <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <BarChart2 className="w-3.5 h-3.5" />
        Pewność per temat
      </div>
      <div className="space-y-1.5">
        {Array.from(byTopic.entries()).map(([topic, vals]) => {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          const avgRounded = Math.round(avg * 10) / 10;
          return (
            <div key={topic} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate w-32 shrink-0">{topic}</span>
              <div className="flex gap-0.5 items-center">
                {vals.map((v, i) => (
                  <span
                    key={i}
                    className={cn(
                      "inline-block w-2 h-2 rounded-sm",
                      v <= 2 ? "bg-red-500" : v === 3 ? "bg-yellow-500" : "bg-green-500"
                    )}
                    title={`${v}/5`}
                  />
                ))}
              </div>
              <span className={cn("text-xs font-medium ml-1", avg <= 2 ? "text-red-500" : avg < 4 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400")}>
                {avgRounded}/5
              </span>
              {avg <= 2 && (
                <span className="text-[10px] bg-red-500/10 text-red-500 rounded px-1 ml-0.5">wymaga powtórki</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExamCardProps {
  exam: ExamWithSessions;
  onToggleSession: (examId: string, sessionId: string, done: boolean) => void;
  onDelete?: (examId: string) => void;
  onEdit?: (exam: ExamWithSessions) => void;
  onGenerateFlashcards?: (exam: ExamWithSessions) => void;
  /** Called after session rating is saved so parent can update its state. */
  onSessionRated?: (
    examId: string,
    sessionId: string,
    confidence: number,
    notes: string,
    retrySession?: StudySession
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExamCard({
  exam,
  onToggleSession,
  onDelete,
  onEdit,
  onGenerateFlashcards,
  onSessionRated,
}: ExamCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { start: startPomodoro } = usePomodoroTimer();

  // Rating modal state
  const [ratingSession, setRatingSession] = useState<StudySession | null>(null);

  // Quiz modal state
  const [quizState, setQuizState] = useState<{
    sessionId?: string;
    topic: string;
    type: "pre" | "post";
  } | null>(null);

  const daysUntil = getDaysUntil(new Date(exam.examDate));
  const todayStr = getTodayStr();
  const category = exam.category;

  const completedSessions = exam.studySessions.filter((s) => s.done).length;
  const totalSessions = exam.studySessions.length;
  const progressPercent = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  const getCountdownColor = () => {
    if (daysUntil <= 0) return "bg-destructive/15 text-destructive border border-destructive/25";
    if (daysUntil < 3) return "bg-destructive text-destructive-foreground";
    if (daysUntil < 7) return "bg-urgency-high/15 text-urgency-high border border-urgency-high/25";
    return "bg-urgency-low/15 text-urgency-low border border-urgency-low/25";
  };

  const handleSessionChange = (sessionId: string, checked: boolean) => {
    onToggleSession(exam.id, sessionId, checked);
    if (checked) {
      const s = exam.studySessions.find((ss) => ss.id === sessionId);
      if (s) setRatingSession(s);
    }
  };

  const handleRatingComplete = (
    confidence: number,
    notes: string,
    retryCreated: boolean,
    retryTopic?: string
  ) => {
    if (ratingSession) {
      onSessionRated?.(exam.id, ratingSession.id, confidence, notes);
    }
    if (retryCreated && retryTopic) {
      toast.success(`Dodano sesję powtórkową: „${retryTopic}"`);
    }
    setRatingSession(null);
  };

  return (
    <>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1 pr-8">{exam.title}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {formatDate(new Date(exam.examDate))}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", getCountdownColor())}>
                  {daysUntil > 0 ? `zostało ${daysUntil} dni` : daysUntil === 0 ? "dziś!" : "termin minął"}
                </span>
                <span className="text-xs text-muted-foreground">{exam.dailyHours}h/dzień</span>
                {exam.interleaved && (
                  <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/40">
                    <Shuffle className="w-2.5 h-2.5" />
                    Interleaving
                  </Badge>
                )}
                {category && (
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${category.color}20`, color: category.color }}
                  >
                    {category.name}
                  </Badge>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(exam)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edytuj egzamin
                  </DropdownMenuItem>
                )}
                {onGenerateFlashcards && (
                  <DropdownMenuItem onClick={() => onGenerateFlashcards(exam)}>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Generuj fiszki
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Usuń egzamin
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Postęp</span>
              <span>{completedSessions}/{totalSessions} sesji</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-3 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <><span>Ukryj plan nauki</span><ChevronUp className="h-4 w-4 ml-1" /></>
            ) : (
              <><span>Zobacz plan nauki</span><ChevronDown className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="border-t border-border bg-secondary/30">
            <div className="divide-y divide-border">
              {exam.studySessions.map((session) => {
                const sessionDateStr = getDateStr(session.date);
                const sessionIsToday = sessionDateStr === todayStr;
                const sessionIsPast = sessionDateStr < todayStr;

                return (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      sessionIsToday && "border-l-4 border-l-accent bg-accent/10",
                      sessionIsPast && !session.done && "opacity-60"
                    )}
                  >
                    <Checkbox
                      checked={session.done}
                      onCheckedChange={(checked) => handleSessionChange(session.id, checked as boolean)}
                    />

                    <span className={cn("text-sm text-muted-foreground w-20 shrink-0", sessionIsPast && session.done && "line-through")}>
                      {formatDate(new Date(session.date))}
                    </span>

                    <span className={cn("text-sm flex-1 min-w-0 truncate", session.done && "line-through text-muted-foreground", sessionIsToday && "font-medium")}>
                      {session.topic}
                    </span>

                    {/* Confidence dot (done sessions) */}
                    {session.done && <ConfidenceDot confidence={session.confidence} />}

                    <span className="inline-flex items-center rounded-md bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium shrink-0">
                      {session.hours}h
                    </span>

                    {/* Pre-quiz button — today's pending sessions */}
                    {sessionIsToday && !session.done && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 text-primary hover:text-primary"
                        onClick={() => setQuizState({ sessionId: session.id, topic: session.topic, type: "pre" })}
                        title="Pre-quiz (sprawdź co pamiętasz)"
                      >
                        <Brain className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Pomodoro button — today's pending sessions */}
                    {sessionIsToday && !session.done && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 text-primary hover:text-primary"
                        onClick={() => startPomodoro({ examTitle: exam.title, topic: session.topic })}
                        aria-label="Rozpocznij Pomodoro"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Re-rate button — done sessions with no confidence yet */}
                    {session.done && session.confidence == null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => setRatingSession(session as StudySession)}
                        title="Oceń sesję"
                      >
                        Oceń
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Per-topic confidence chart */}
            <ConfidenceChart sessions={exam.studySessions as StudySession[]} />
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń egzamin?</AlertDialogTitle>
            <AlertDialogDescription>
              „{exam.title}" oraz wszystkie sesje nauki zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete?.(exam.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session rating modal */}
      <SessionRatingModal
        open={!!ratingSession}
        onOpenChange={(v) => { if (!v) setRatingSession(null); }}
        examId={exam.id}
        sessionId={ratingSession?.id ?? ""}
        topic={ratingSession?.topic ?? ""}
        examTitle={exam.title}
        onComplete={handleRatingComplete}
        onStartQuiz={() => {
          if (ratingSession) {
            setQuizState({ sessionId: ratingSession.id, topic: ratingSession.topic, type: "post" });
          }
          setRatingSession(null);
        }}
      />

      {/* Quiz modal */}
      {quizState && (
        <QuizModal
          open={!!quizState}
          onOpenChange={(v) => { if (!v) setQuizState(null); }}
          examId={exam.id}
          sessionId={quizState.sessionId}
          topic={quizState.topic}
          examTitle={exam.title}
          type={quizState.type}
          onComplete={(sc, total) => {
            const pct = Math.round((sc / total) * 100);
            toast.success(`Quiz: ${sc}/${total} (${pct}%) — ${pct >= 80 ? "Świetnie!" : pct >= 60 ? "Nieźle!" : "Warto powtórzyć."}`);
            setQuizState(null);
          }}
        />
      )}
    </>
  );
}
