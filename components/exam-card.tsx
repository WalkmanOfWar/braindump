"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ExamWithSessions } from "@/types";

interface ExamCardProps {
  exam: ExamWithSessions;
  onToggleSession: (examId: string, sessionId: string, done: boolean) => void;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  });
}

function getDaysUntil(date: Date | string): number {
  const now = new Date();
  return Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ExamCard({ exam, onToggleSession }: ExamCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const daysUntil = getDaysUntil(exam.examDate);
  const category = exam.category;

  const completedSessions = exam.studySessions.filter((s) => s.done).length;
  const totalSessions = exam.studySessions.length;
  const progressPercent =
    totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  const getCountdownColor = () => {
    if (daysUntil < 3) return "bg-destructive text-destructive-foreground";
    if (daysUntil < 7) return "bg-warning text-accent-foreground";
    return "bg-success text-accent-foreground";
  };

  const isToday = (date: Date | string) => {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (date: Date | string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1">{exam.title}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {formatDate(exam.examDate)}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-xs", getCountdownColor())}>
                {daysUntil > 0 ? `zostało ${daysUntil} dni` : "termin minął"}
              </Badge>
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
              const sessionIsToday = isToday(session.date);
              const sessionIsPast = isPast(session.date) && !sessionIsToday;

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
                    {formatDate(session.date)}
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

                  <Badge className="bg-accent text-accent-foreground shrink-0">
                    {session.hours}h
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
