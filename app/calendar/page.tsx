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
  GripVertical,
} from "lucide-react";
import type { TaskWithCategory, ExamWithSessions } from "@/types";
import type { StudySession } from "@prisma/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

type CalendarItem =
  | { type: "task"; data: TaskWithCategory }
  | { type: "session"; data: StudySession & { examTitle: string } };

const DAYS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];

type ViewMode = "week" | "month";

function getMonthGridDays(date: Date): Date[] {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const dow = monthStart.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() + offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

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

// ── Draggable task pill ────────────────────────────────────────────────────────

function DraggableTaskPill({
  task,
  onOpen,
  compact = false,
}: {
  task: TaskWithCategory;
  onOpen: () => void;
  compact?: boolean;
}) {
  const color = task.category?.color ?? "#888888";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task } });

  const style: React.CSSProperties = {
    backgroundColor: `${color}30`,
    color,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    // opacity-0: the DragOverlay already renders the pill following the cursor;
    // keeping the source visible at any opacity creates an ugly double-card.
    opacity: isDragging ? 0 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full text-left rounded truncate flex items-center gap-1 touch-none select-none",
        compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-1 text-xs"
      )}
      {...listeners}
      {...attributes}
    >
      {!compact && <GripVertical className="h-3 w-3 shrink-0 opacity-40" />}
      {task.done && (
        <span className="w-1.5 h-1.5 rounded-full bg-urgency-low shrink-0" />
      )}
      <button
        className="truncate flex-1 text-left hover:opacity-80"
        // dnd-kit hooks pointerdown on the draggable ref — stopping it on this inner
        // button lets it register as a click instead of starting a drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onOpen}
      >
        {task.title}
      </button>
    </div>
  );
}

// ── Droppable day cell ─────────────────────────────────────────────────────────

function DroppableDayCell({
  dayIso,
  todayDay,
  children,
}: {
  dayIso: string;
  todayDay: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayIso });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] sm:min-h-[160px] border rounded-lg p-1 sm:p-2 transition-colors duration-150",
        todayDay
          ? "bg-accent/10 border-accent/30"
          : "border-border",
        isOver && "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
      )}
    >
      {children}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

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

  const monthGridDays = useMemo(
    () => (viewMode === "month" ? getMonthGridDays(currentDate) : []),
    [viewMode, currentDate]
  );

  const goBack = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const goForward = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  // Pre-group all items by YYYY-MM-DD once; each day cell does an O(1) lookup
  // instead of scanning all tasks + sessions on every render (critical in month view: 42 cells).
  const itemsByDate = useMemo(() => {
    const dateKey = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE");
    const map = new Map<string, CalendarItem[]>();

    tasks.forEach((task) => {
      if (!task.deadline) return;
      const key = dateKey(task.deadline);
      const list = map.get(key) ?? [];
      list.push({ type: "task", data: task });
      map.set(key, list);
    });

    exams.forEach((exam) => {
      exam.studySessions.forEach((session) => {
        const key = dateKey(session.date);
        const list = map.get(key) ?? [];
        list.push({ type: "session", data: { ...session, examTitle: exam.title } });
        map.set(key, list);
      });
    });

    return map;
  }, [tasks, exams]);

  const getItemsForDay = (date: Date): CalendarItem[] =>
    itemsByDate.get(date.toLocaleDateString("sv-SE")) ?? [];

  const formatWeekRange = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(weekStart.getDate() + 6);
    const month = weekStart.toLocaleDateString("pl-PL", { month: "long" });
    return `${weekStart.getDate()}–${endDate.getDate()} ${month} ${weekStart.getFullYear()}`;
  };

  const formatMonthLabel = () =>
    currentDate.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  const rangeLabel = viewMode === "week" ? formatWeekRange() : formatMonthLabel();

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over) return;

    const taskId = active.id as string;
    // over.id is "YYYY-MM-DD" (sv-SE format) — parse as local date to avoid
    // UTC-offset shift that toISOString() would introduce (e.g. UTC+2 → prev day)
    const [y, m, d] = (over.id as string).split("-").map(Number);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Build new deadline in local time; preserve existing time-of-day if set
    const newDeadline = new Date(y, m - 1, d);
    if (task.deadline) {
      const existing = new Date(task.deadline);
      newDeadline.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
    } else {
      newDeadline.setHours(9, 0, 0, 0);
    }

    // If dropped on the same day, do nothing
    if (task.deadline && sameDay(task.deadline, newDeadline)) return;

    // Restore only this task's deadline on failure — avoids reverting concurrent updates
    const originalDeadline = task.deadline;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, deadline: newDeadline } : t))
    );

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: newDeadline.toISOString() }),
    });

    if (!res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, deadline: originalDeadline } : t))
      );
      toast.error("Nie udało się zmienić terminu");
    } else {
      const updated: TaskWithCategory = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      toast.success("Termin zadania zmieniony");
    }
  };

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Poprzedni
            </Button>
            <span className="text-sm font-medium text-foreground px-2 hidden sm:inline capitalize">
              {rangeLabel}
            </span>
            <Button variant="outline" size="sm" onClick={goForward}>
              Następny
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Right controls: Today + view toggle */}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>
              Dziś
            </Button>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("week")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "week"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Tydzień
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors border-l border-border",
                  viewMode === "month"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                Miesiąc
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm font-medium text-foreground mb-4 sm:hidden text-center capitalize">
          {rangeLabel}
        </p>

        {/* Single DndContext covers both views so drag works in month too */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {viewMode === "week" ? (
            /* ── Week view ── */
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Day headers */}
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
                  <div className={cn("text-lg font-semibold", isToday(day) ? "text-accent-foreground" : "text-foreground")}>
                    {day.getDate()}
                  </div>
                </div>
              ))}

              {/* Droppable day cells — ID is YYYY-MM-DD (sv-SE) to avoid UTC-shift */}
              {weekDays.map((day) => {
                const items = getItemsForDay(day);
                const dayKey = day.toLocaleDateString("sv-SE");
                return (
                  <DroppableDayCell key={dayKey} dayIso={dayKey} todayDay={isToday(day)}>
                    <div className="space-y-1">
                      {items.slice(0, 4).map((item, i) => {
                        if (item.type === "task") {
                          return (
                            <DraggableTaskPill
                              key={`task-${item.data.id}-${i}`}
                              task={item.data}
                              onOpen={() => { setSelectedItem(item); setSheetOpen(true); }}
                            />
                          );
                        }
                        const session = item.data;
                        return (
                          <button
                            key={`session-${session.id}-${i}`}
                            onClick={() => { setSelectedItem(item); setSheetOpen(true); }}
                            className={cn(
                              "w-full text-left px-1.5 py-1 rounded text-xs truncate flex items-center gap-1 hover:opacity-80 transition-opacity",
                              session.done ? "bg-accent/20 text-accent line-through opacity-60" : "bg-accent/20 text-accent"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                            <span className="truncate">{session.topic}</span>
                          </button>
                        );
                      })}
                      {items.length > 4 && (
                        <div className="text-xs text-muted-foreground px-1">+{items.length - 4} więcej</div>
                      )}
                    </div>
                  </DroppableDayCell>
                );
              })}
            </div>
          ) : (
            /* ── Month view — droppable cells + draggable task pills ── */
            <div>
              <div className="grid grid-cols-7 mb-1">
                {DAYS_PL.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
                {monthGridDays.map((day, i) => {
                  const items = getItemsForDay(day);
                  const inMonth = day.getMonth() === currentDate.getMonth();
                  const dayKey = day.toLocaleDateString("sv-SE");
                  return (
                    <DroppableDayCell key={i} dayIso={dayKey} todayDay={isToday(day)}>
                      <div className={cn(
                        "min-h-[80px] sm:min-h-[96px]",
                        !inMonth && "opacity-40"
                      )}>
                        {/* Day number */}
                        <div className={cn(
                          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5",
                          isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                        )}>
                          {day.getDate()}
                        </div>

                        {/* Event pills */}
                        <div className="space-y-0.5">
                          {items.slice(0, 2).map((item, j) => {
                            if (item.type === "task") {
                              return (
                                <DraggableTaskPill
                                  key={`m-task-${item.data.id}-${j}`}
                                  task={item.data}
                                  compact
                                  onOpen={() => { setSelectedItem(item); setSheetOpen(true); }}
                                />
                              );
                            }
                            return (
                              <button
                                key={`m-sess-${item.data.id}-${j}`}
                                onClick={() => { setSelectedItem(item); setSheetOpen(true); }}
                                className={cn(
                                  "w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight truncate bg-accent/20 text-accent hover:opacity-80 transition-opacity",
                                  item.data.done && "line-through opacity-50"
                                )}
                              >
                                {item.data.topic}
                              </button>
                            );
                          })}
                          {items.length > 2 && (
                            <div className="text-[10px] text-muted-foreground px-0.5">+{items.length - 2}</div>
                          )}
                        </div>
                      </div>
                    </DroppableDayCell>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drag overlay — outside both views so it renders in both modes */}
          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div
                className="px-2 py-1 rounded text-xs font-semibold shadow-xl border border-primary/40 bg-card text-foreground max-w-[140px] truncate rotate-1"
                style={{ color: activeTask.category?.color ?? undefined }}
              >
                {activeTask.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>

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
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
            — przeciągnij zadanie aby zmienić termin
          </span>
        </div>
      </main>

      <BottomNav />

      {/* Detail sheet */}
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
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Tytuł</p>
                    <p className={cn(
                      "font-semibold text-foreground leading-snug",
                      selectedItem.data.done && "line-through text-muted-foreground"
                    )}>
                      {selectedItem.data.title}
                    </p>
                  </div>

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
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Temat</p>
                    <p className={cn(
                      "font-semibold text-foreground leading-snug",
                      selectedItem.data.done && "line-through text-muted-foreground"
                    )}>
                      {selectedItem.data.topic}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      Egzamin
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {selectedItem.data.examTitle}
                    </p>
                  </div>

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
