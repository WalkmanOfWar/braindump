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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CalendarItem =
  | { type: "task"; data: TaskWithCategory }
  | { type: "session"; data: StudySession & { examTitle: string } };

type ViewMode = "week" | "month";

const DAYS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Week view — draggable task card (kanban-style)
// ─────────────────────────────────────────────────────────────────────────────

function DraggableTaskCard({
  task,
  onOpen,
}: {
  task: TaskWithCategory;
  onOpen: () => void;
}) {
  const color = task.category?.color ?? "#6b7280";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task } });

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform) ?? undefined,
        borderLeftColor: color,
        opacity: isDragging ? 0 : 1,
      }}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 bg-card rounded-lg border border-l-[3px] shadow-sm",
        "touch-none select-none cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
      )}
    >
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
      <div className="flex-1 min-w-0">
        <button
          className={cn(
            "w-full text-left text-sm font-medium leading-tight truncate hover:text-primary transition-colors",
            task.done && "line-through text-muted-foreground"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onOpen}
        >
          {task.title}
        </button>
        {(deadline || task.category) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {deadline && (
              <span className="text-[11px] text-muted-foreground">{deadline}</span>
            )}
            {task.category && (
              <span
                className="text-[11px] font-medium rounded px-1 leading-tight"
                style={{ backgroundColor: `${color}18`, color }}
              >
                {task.category.name}
              </span>
            )}
          </div>
        )}
      </div>
      {task.done && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-urgency-low" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week view — session pill
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onOpen,
}: {
  session: StudySession & { examTitle: string };
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg border border-l-[3px] border-l-accent shadow-sm text-sm transition-shadow hover:shadow-md",
        session.done
          ? "bg-accent/5 text-muted-foreground line-through opacity-60"
          : "bg-accent/10 text-accent"
      )}
    >
      <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-60" />
      <span className="truncate flex-1">{session.topic}</span>
      {session.done && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week view — droppable column (kanban-style)
// ─────────────────────────────────────────────────────────────────────────────

function WeekColumn({
  day,
  dayIndex,
  items,
  onOpenItem,
}: {
  day: Date;
  dayIndex: number;
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
}) {
  const dayKey = day.toLocaleDateString("sv-SE");
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const today = isToday(day);

  return (
    <div
      className={cn(
        "flex flex-col min-w-[150px] flex-1 rounded-2xl border border-border bg-card/60 overflow-hidden transition-all duration-150",
        today && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          "flex flex-col items-center px-2 py-2.5 border-b border-border select-none",
          today ? "bg-primary/5" : "",
          isOver && "bg-primary/5"
        )}
      >
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {DAYS_PL[dayIndex]}
        </span>
        <span
          className={cn(
            "text-lg font-bold leading-none mt-0.5",
            today ? "text-primary" : "text-foreground"
          )}
        >
          {day.getDate()}
        </span>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[140px] p-2 space-y-1.5 transition-colors duration-150",
          isOver && "bg-primary/5"
        )}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[100px]">
            <p className="text-[10px] text-muted-foreground/40 select-none">—</p>
          </div>
        ) : (
          <>
            {items.map((item, i) =>
              item.type === "task" ? (
                <DraggableTaskCard
                  key={`task-${item.data.id}-${i}`}
                  task={item.data}
                  onOpen={() => onOpenItem(item)}
                />
              ) : (
                <SessionCard
                  key={`sess-${item.data.id}-${i}`}
                  session={item.data}
                  onOpen={() => onOpenItem(item)}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month view — draggable task chip (compact)
// ─────────────────────────────────────────────────────────────────────────────

function DraggableTaskChip({
  task,
  onOpen,
}: {
  task: TaskWithCategory;
  onOpen: () => void;
}) {
  const color = task.category?.color ?? "#6b7280";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { task } });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform) ?? undefined,
        backgroundColor: `${color}20`,
        color,
        opacity: isDragging ? 0 : 1,
      }}
      className="w-full px-1 py-0.5 rounded-md text-[11px] leading-tight touch-none select-none cursor-grab active:cursor-grabbing"
    >
      <button
        className={cn("w-full text-left truncate", task.done && "line-through opacity-60")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onOpen}
      >
        {task.title}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month view — droppable day cell
// ─────────────────────────────────────────────────────────────────────────────

function MonthCell({
  day,
  items,
  inMonth,
  onOpenItem,
}: {
  day: Date;
  items: CalendarItem[];
  inMonth: boolean;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const dayKey = day.toLocaleDateString("sv-SE");
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const today = isToday(day);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[90px] sm:min-h-[110px] p-2 rounded-xl border transition-colors duration-150",
        !inMonth && "opacity-35",
        today ? "bg-primary/5 border-primary/40" : "border-border bg-card/50",
        isOver && "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
      )}
    >
      {/* Day number */}
      <div
        className={cn(
          "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-1 select-none",
          today
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground"
        )}
      >
        {day.getDate()}
      </div>

      {/* Event pills */}
      <div className="space-y-0.5">
        {items.slice(0, 2).map((item, j) =>
          item.type === "task" ? (
            <DraggableTaskChip
              key={`mc-task-${item.data.id}-${j}`}
              task={item.data}
              onOpen={() => onOpenItem(item)}
            />
          ) : (
            <button
              key={`mc-sess-${item.data.id}-${j}`}
              onClick={() => onOpenItem(item)}
              className={cn(
                "w-full text-left px-1 py-0.5 rounded-md text-[11px] leading-tight truncate bg-accent/15 text-accent hover:bg-accent/25 transition-colors",
                item.data.done && "line-through opacity-50"
              )}
            >
              {item.data.topic}
            </button>
          )
        )}
        {items.length > 2 && (
          <p className="text-[10px] text-muted-foreground px-0.5 font-medium">
            +{items.length - 2}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag overlay card
// ─────────────────────────────────────────────────────────────────────────────

function DragOverlayCard({ task }: { task: TaskWithCategory | null }) {
  if (!task) return null;
  const color = task.category?.color ?? "#6b7280";
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-2 bg-card rounded-lg border border-primary/40 shadow-2xl text-xs font-medium max-w-[160px] rotate-1"
      style={{ borderLeftWidth: 3, borderLeftColor: color, color }}
    >
      <GripVertical className="w-3 h-3 shrink-0 opacity-40" />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  // Pre-group all items by YYYY-MM-DD for O(1) day lookup (critical in 42-cell month grid)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    tasks.forEach((task) => {
      if (!task.deadline) return;
      const key = new Date(task.deadline).toLocaleDateString("sv-SE");
      const list = map.get(key) ?? [];
      list.push({ type: "task", data: task });
      map.set(key, list);
    });

    exams.forEach((exam) => {
      exam.studySessions.forEach((session) => {
        const key = new Date(session.date).toLocaleDateString("sv-SE");
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
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    const month = weekStart.toLocaleDateString("pl-PL", { month: "long" });
    return `${weekStart.getDate()}–${end.getDate()} ${month} ${weekStart.getFullYear()}`;
  };

  const formatMonthLabel = () =>
    currentDate.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  const rangeLabel = viewMode === "week" ? formatWeekRange() : formatMonthLabel();

  // ── DnD ──────────────────────────────────────────────────────────────────────

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
    // over.id is "YYYY-MM-DD" (sv-SE) — parse as local date to avoid UTC-offset shift
    const [y, m, d] = (over.id as string).split("-").map(Number);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Preserve existing time-of-day; default to 09:00 when no deadline set
    const newDeadline = new Date(y, m - 1, d);
    if (task.deadline) {
      const existing = new Date(task.deadline);
      newDeadline.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
    } else {
      newDeadline.setHours(9, 0, 0, 0);
    }

    if (task.deadline && sameDay(task.deadline, newDeadline)) return;

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

  const openItem = (item: CalendarItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Poprzedni
            </Button>
            <span className="text-sm font-semibold text-foreground px-2 hidden sm:inline capitalize">
              {rangeLabel}
            </span>
            <Button variant="outline" size="sm" onClick={goForward}>
              Następny
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>
              Dziś
            </Button>
            <div className="flex rounded-lg border border-border overflow-hidden">
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

        {/* Mobile range label */}
        <p className="text-sm font-semibold text-foreground mb-4 sm:hidden text-center capitalize">
          {rangeLabel}
        </p>

        {/* ── Calendar (single DndContext covers both views) ── */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

          {viewMode === "week" ? (
            /* ── Week view — scrollable kanban-style columns ── */
            <div className="flex gap-2 overflow-x-auto pb-2">
              {weekDays.map((day, i) => (
                <WeekColumn
                  key={i}
                  day={day}
                  dayIndex={i}
                  items={getItemsForDay(day)}
                  onOpenItem={openItem}
                />
              ))}
            </div>
          ) : (
            /* ── Month view — clean grid of droppable cells ── */
            <div>
              {/* Day-of-week header row */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_PL.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-widest select-none"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {monthGridDays.map((day, i) => (
                  <MonthCell
                    key={i}
                    day={day}
                    items={getItemsForDay(day)}
                    inMonth={day.getMonth() === currentDate.getMonth()}
                    onOpenItem={openItem}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Drag overlay — outside both view branches, always rendered */}
          <DragOverlay dropAnimation={null}>
            <DragOverlayCard task={activeTask} />
          </DragOverlay>

        </DndContext>

        {/* Legend */}
        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Legenda:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-l-2 border-l-accent bg-accent/10" />
            <span className="text-xs text-muted-foreground">Sesja nauki</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-foreground/15 border-l-2 border-l-foreground/40" />
            <span className="text-xs text-muted-foreground">Zadanie</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — przeciągnij zadanie aby zmienić termin
          </span>
        </div>
      </main>

      <BottomNav />

      {/* ── Detail sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[320px] sm:w-[380px] p-0 flex flex-col gap-0">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                selectedItem?.type === "task"
                  ? "bg-primary/15 text-primary"
                  : "bg-accent/15 text-accent"
              )}
            >
              {selectedItem?.type === "task"
                ? <CheckSquare className="h-4 w-4" />
                : <BookOpen className="h-4 w-4" />}
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
                    <p className={cn("font-semibold text-foreground leading-snug", selectedItem.data.done && "line-through text-muted-foreground")}>
                      {selectedItem.data.title}
                    </p>
                  </div>

                  {selectedItem.data.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <AlignLeft className="h-3 w-3" />Opis
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
                          <Calendar className="h-3.5 w-3.5" />Termin
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {formatDateFull(selectedItem.data.deadline)}
                        </span>
                      </div>
                    )}
                    {selectedItem.data.category && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" />Kategoria
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
                            className={cn("w-2 h-2 rounded-full", level <= selectedItem.data.priority ? "bg-primary" : "bg-border")}
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
                          : <><Circle className="h-3 w-3" />Aktywne</>}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Temat</p>
                    <p className={cn("font-semibold text-foreground leading-snug", selectedItem.data.done && "line-through text-muted-foreground")}>
                      {selectedItem.data.topic}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />Egzamin
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {selectedItem.data.examTitle}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />Data
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {formatDateFull(selectedItem.data.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />Czas nauki
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
                          : <><Circle className="h-3 w-3" />Do zrobienia</>}
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
