"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  BookOpen,
  CheckSquare,
  CheckCircle2,
  Circle,
  AlignLeft,
  Tag,
} from "lucide-react";
import type { TaskWithCategory, ExamWithSessions } from "@/types";
import type { StudySession } from "@prisma/client";

type CalendarItem =
  | { type: "task"; data: TaskWithCategory }
  | { type: "session"; data: StudySession & { examTitle: string } };

const DAYS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];

function formatDateFull(date: Date | string): string {
  return new Date(date).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date | string, b: Date): boolean {
  const da = new Date(a);
  return (
    da.getDate() === b.getDate() &&
    da.getMonth() === b.getMonth() &&
    da.getFullYear() === b.getFullYear()
  );
}

function isToday(date: Date): boolean {
  return sameDay(new Date(), date);
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [tasksRes, examsRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/exams"),
    ]);
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (examsRes.ok) setExams(await examsRes.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const weekStart = getWeekStart(currentDate);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [weekStart]);

  const getItemsForDay = (date: Date): CalendarItem[] => {
    const items: CalendarItem[] = [];
    tasks.forEach((task) => {
      if (task.deadline && sameDay(task.deadline, date)) {
        items.push({ type: "task", data: task });
      }
    });
    exams.forEach((exam) => {
      exam.studySessions.forEach((session) => {
        if (sameDay(session.date, date)) {
          items.push({
            type: "session",
            data: { ...session, examTitle: exam.title },
          });
        }
      });
    });
    return items;
  };

  const formatWeekRange = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(weekStart.getDate() + 6);
    const month = weekStart.toLocaleDateString("pl-PL", { month: "long" });
    return `${weekStart.getDate()}–${endDate.getDate()} ${month} ${weekStart.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - 7);
                setCurrentDate(d);
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Poprzedni
            </Button>
            <span className="text-sm font-medium text-foreground px-2 hidden sm:inline">
              {formatWeekRange()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
            >
              Następny
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>
            Dziś
          </Button>
        </div>

        <p className="text-sm font-medium text-foreground mb-4 sm:hidden text-center">
          {formatWeekRange()}
        </p>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((day, index) => (
            <div
              key={`header-${index}`}
              className={cn(
                "text-center py-2 px-1",
                isToday(day) && "bg-accent/20 rounded-t-lg"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {DAYS_PL[index]}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  isToday(day) ? "text-accent-foreground" : "text-foreground"
                )}
              >
                {day.getDate()}
              </div>
            </div>
          ))}

          {weekDays.map((day, index) => {
            const items = getItemsForDay(day);
            return (
              <div
                key={`cell-${index}`}
                className={cn(
                  "min-h-[120px] sm:min-h-[160px] border border-border rounded-lg p-1 sm:p-2",
                  isToday(day) && "bg-accent/10 border-accent/30"
                )}
              >
                <div className="space-y-1">
                  {items.slice(0, 4).map((item, i) => {
                    if (item.type === "task") {
                      const task = item.data;
                      const color = task.category?.color ?? "#888888";
                      return (
                        <button
                          key={`task-${task.id}-${i}`}
                          onClick={() => { setSelectedItem(item); setSheetOpen(true); }}
                          className="w-full text-left px-1.5 py-1 rounded text-xs truncate flex items-center gap-1 hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: `${color}30`,
                            color,
                          }}
                        >
                          {task.done && (
                            <span className="w-1.5 h-1.5 rounded-full bg-urgency-low shrink-0" />
                          )}
                          <span className="truncate">{task.title}</span>
                        </button>
                      );
                    } else {
                      const session = item.data;
                      return (
                        <button
                          key={`session-${session.id}-${i}`}
                          onClick={() => { setSelectedItem(item); setSheetOpen(true); }}
                          className={cn(
                            "w-full text-left px-1.5 py-1 rounded text-xs truncate flex items-center gap-1 hover:opacity-80 transition-opacity",
                            session.done
                              ? "bg-accent/20 text-accent line-through opacity-60"
                              : "bg-accent/20 text-accent"
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                          <span className="truncate">{session.topic}</span>
                        </button>
                      );
                    }
                  })}
                  {items.length > 4 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{items.length - 4} więcej
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground">Legenda:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-accent" />
            <span className="text-xs text-muted-foreground">Sesja nauki</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-foreground/20" />
            <span className="text-xs text-muted-foreground">Zadanie</span>
          </div>
        </div>
      </main>

      <BottomNav />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[320px] sm:w-[380px] p-0 flex flex-col gap-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
              selectedItem?.type === "task"
                ? "bg-primary/15 text-primary"
                : "bg-accent/15 text-accent"
            )}>
              {selectedItem?.type === "task"
                ? <CheckSquare className="h-4 w-4" />
                : <BookOpen className="h-4 w-4" />
              }
            </div>
            <SheetHeader className="p-0 text-left">
              <SheetTitle className="text-base">
                {selectedItem?.type === "task" ? "Szczegóły zadania" : "Szczegóły sesji"}
              </SheetTitle>
            </SheetHeader>
          </div>

          {selectedItem && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {selectedItem.type === "task" ? (
                <>
                  {/* Title */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Tytuł</p>
                    <p className={cn(
                      "font-semibold text-foreground leading-snug",
                      selectedItem.data.done && "line-through text-muted-foreground"
                    )}>
                      {selectedItem.data.title}
                    </p>
                  </div>

                  {/* Description */}
                  {selectedItem.data.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <AlignLeft className="h-3 w-3" />
                        Opis
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedItem.data.description}
                      </p>
                    </div>
                  )}

                  {/* Info rows */}
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    {selectedItem.data.deadline && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Termin
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {formatDateFull(selectedItem.data.deadline)}
                        </span>
                      </div>
                    )}
                    {selectedItem.data.category && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" />
                          Kategoria
                        </span>
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${selectedItem.data.category.color}20`,
                            color: selectedItem.data.category.color,
                          }}
                        >
                          {selectedItem.data.category.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Priorytet</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={cn(
                              "w-2 h-2 rounded-full",
                              level <= selectedItem.data.priority ? "bg-primary" : "bg-border"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                        selectedItem.data.done
                          ? "bg-urgency-low/15 text-urgency-low"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {selectedItem.data.done
                          ? <><CheckCircle2 className="h-3 w-3" />Ukończone</>
                          : <><Circle className="h-3 w-3" />Aktywne</>
                        }
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Topic */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Temat</p>
                    <p className={cn(
                      "font-semibold text-foreground leading-snug",
                      selectedItem.data.done && "line-through text-muted-foreground"
                    )}>
                      {selectedItem.data.topic}
                    </p>
                  </div>

                  {/* Exam name */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      Egzamin
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {selectedItem.data.examTitle}
                    </p>
                  </div>

                  {/* Info rows */}
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Data
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {formatDateFull(selectedItem.data.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Czas nauki
                      </span>
                      <span className="inline-flex items-center rounded-md bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium">
                        {selectedItem.data.hours}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                        selectedItem.data.done
                          ? "bg-urgency-low/15 text-urgency-low"
                          : "bg-primary/10 text-primary"
                      )}>
                        {selectedItem.data.done
                          ? <><CheckCircle2 className="h-3 w-3" />Ukończona</>
                          : <><Circle className="h-3 w-3" />Do zrobienia</>
                        }
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
