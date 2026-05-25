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
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2, Pencil, Play } from "lucide-react";
import type { ExamWithSessions } from "@/types";
import { usePomodoroTimer } from "@/components/pomodoro-timer";

interface ExamCardProps {
  exam: ExamWithSessions;
  onToggleSession: (examId: string, sessionId: string, done: boolean) => void;
  onDelete?: (examId: string) => void;
  onEdit?: (exam: ExamWithSessions) => void;
}

export function ExamCard({ exam, onToggleSession, onDelete, onEdit }: ExamCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { start: startPomodoro } = usePomodoroTimer();

  const daysUntil = getDaysUntil(new Date(exam.examDate));
  const todayStr = getTodayStr();
  const category = exam.category;

  const completedSessions = exam.studySessions.filter((s) => s.done).length;
  const totalSessions = exam.studySessions.length;
  const progressPercent =
    totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  const getCountdownColor = () => {
    if (daysUntil <= 0) return "bg-destructive/15 text-destructive border border-destructive/25";
    if (daysUntil < 3) return "bg-destructive text-destructive-foreground";
    if (daysUntil < 7) return "bg-urgency-high/15 text-urgency-high border border-urgency-high/25";
    return "bg-urgency-low/15 text-urgency-low border border-urgency-low/25";
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
              <span className="text-xs text-muted-foreground">
                {exam.dailyHours}h/dzień
              </span>
              {category && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: `${category.color}20`,
                    color: category.color,
                  }}
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
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Usuń egzamin
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Postęp</span>
            <span>
              {completedSessions}/{totalSessions} sesji
            </span>
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
            <>
              Ukryj plan nauki
              <ChevronUp className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Zobacz plan nauki
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
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
                    sessionIsToday &&
                      "border-l-4 border-l-accent bg-accent/10",
                    sessionIsPast && !session.done && "opacity-60"
                  )}
                >
                  <Checkbox
                    checked={session.done}
                    onCheckedChange={(checked) =>
                      onToggleSession(exam.id, session.id, checked as boolean)
                    }
                  />

                  <span
                    className={cn(
                      "text-sm text-muted-foreground w-20 shrink-0",
                      sessionIsPast && session.done && "line-through"
                    )}
                  >
                    {formatDate(new Date(session.date))}
                  </span>

                  <span
                    className={cn(
                      "text-sm flex-1",
                      session.done && "line-through text-muted-foreground",
                      sessionIsToday && "font-medium"
                    )}
                  >
                    {session.topic}
                  </span>

                  <span className="inline-flex items-center rounded-md bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium shrink-0">
                    {session.hours}h
                  </span>

                  {/* Pomodoro start button — only on today's pending sessions */}
                  {sessionIsToday && !session.done && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0 text-primary hover:text-primary"
                      onClick={() =>
                        startPomodoro({ examTitle: exam.title, topic: session.topic })
                      }
                      aria-label="Rozpocznij Pomodoro"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń egzamin?</AlertDialogTitle>
            <AlertDialogDescription>
              „{exam.title}" oraz wszystkie sesje nauki zostaną trwale usunięte. Tej akcji nie można cofnąć.
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
    </>
  );
}
