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
import { cn, toUiTask } from "@/lib/utils";
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
  Pencil,
} from "lucide-react";
import type { TaskWithCategory, ExamWithSessions, Category, UiTask } from "@/types";
import type { StudySession } from "@prisma/client";
import { TaskModal } from "@/components/task-modal";
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
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CalendarItem =
  | { type: "task"; data: TaskWithCategory }
  | { type: "session"; data: StudySession & { examTitle: string } };

type ViewMode = "week" | "month" | "blocks";

const DAYS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];

// Half-hour slots for time-blocks view (8:00 – 23:30 in 30-min steps)
const BLOCK_SLOTS: { hour: number; minute: number }[] = (() => {
  const slots: { hour: number; minute: number }[] = [];
  for (let h = 8; h <= 23; h++) {
    slots.push({ hour: h, minute: 0 });
    slots.push({ hour: h, minute: 30 });
  }
  return slots;
})();

function slotKey(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

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

// 1 slot = 30 min = 44px; proportional height for blocks view
const SLOT_PX = 44;
const SLOT_MIN = 30;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} godz`;
  return `${h} godz ${m} min`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar-style overlap layout
// ─────────────────────────────────────────────────────────────────────────────

interface PositionedEvent {
  task: TaskWithCategory;
  topPx: number;
  heightPx: number;
  /** Column start as a fraction of total width [0, 1) */
  leftFrac: number;
  /** Column width as a fraction of total width (0, 1] */
  widthFrac: number;
}

/**
 * Assigns non-overlapping columns to tasks in the same time range, exactly
 * like Google Calendar.  Two events that start at the same time or whose
 * intervals overlap share the available horizontal space equally.
 */
function computeEventPositions(
  tasksBySlot: Map<string, TaskWithCategory[]>
): PositionedEvent[] {
  type Interval = {
    task: TaskWithCategory;
    slotIdx: number;
    startSlot: number; // index into BLOCK_SLOTS (float)
    endSlot: number;   // exclusive end in slot units
  };

  const events: Interval[] = [];

  BLOCK_SLOTS.forEach(({ hour, minute }, idx) => {
    (tasksBySlot.get(slotKey(hour, minute)) ?? []).forEach((task) => {
      if (task.estimatedMinutes) {
        // Estimated duration set → block extends BACKWARD from deadline
        const durationSlots = task.estimatedMinutes / SLOT_MIN;
        events.push({ task, slotIdx: idx, startSlot: idx - durationSlots, endSlot: idx });
      } else {
        // No estimate → show a 1-slot marker AT the deadline (forward)
        events.push({ task, slotIdx: idx, startSlot: idx, endSlot: idx + 1 });
      }
    });
  });

  if (events.length === 0) return [];

  // Sort by start time; longer events first when start times are equal
  events.sort((a, b) =>
    a.startSlot !== b.startSlot ? a.startSlot - b.startSlot : b.endSlot - a.endSlot
  );

  // Greedy column assignment
  const colAssign: number[] = [];
  const colEnds: number[] = [];

  for (let i = 0; i < events.length; i++) {
    let col = 0;
    while (col < colEnds.length && colEnds[col] > events[i].startSlot + 0.001) col++;
    colAssign[i] = col;
    colEnds[col] = events[i].endSlot;
  }

  const colCount: number[] = events.map((ev, i) => {
    let max = colAssign[i];
    for (let j = 0; j < events.length; j++) {
      if (
        i !== j &&
        events[j].startSlot < ev.endSlot - 0.001 &&
        events[j].endSlot > ev.startSlot + 0.001
      ) {
        max = Math.max(max, colAssign[j]);
      }
    }
    return max + 1;
  });

  return events.map((ev, i) => {
    const rawHeight = Math.max(
      SLOT_PX,
      Math.round(((ev.task.estimatedMinutes ?? SLOT_MIN) / SLOT_MIN) * SLOT_PX)
    );
    // Block ends at the deadline slot; clip top if it would go above the grid
    const rawTop = ev.startSlot * SLOT_PX;
    const topPx = Math.max(0, rawTop);
    const heightPx = rawHeight + Math.min(0, rawTop); // reduce height if clipped at top

    return {
      task: ev.task,
      topPx,
      heightPx: Math.max(SLOT_PX / 2, heightPx),
      leftFrac: colAssign[i] / colCount[i],
      widthFrac: 1 / colCount[i],
    };
  });
}

function DraggableTaskCard({
  task,
  onOpen,
  draggableId,
  durationMinutes,
  className,
}: {
  task: TaskWithCategory;
  onOpen: () => void;
  draggableId?: string;
  durationMinutes?: number;
  className?: string;
}) {
  const id = draggableId ?? task.id;
  const color = task.category?.color ?? "#6b7280";
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({ id, data: { task } });

  const deadline = !durationMinutes && task.deadline
    ? new Date(task.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ borderLeftColor: color }}
      className={cn(
        "flex items-start gap-2 px-3 py-2.5 bg-card rounded-lg border border-l-[3px] shadow-sm",
        "touch-none select-none cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
        isDragging && "opacity-0",
        className
      )}
    >
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "w-full text-left text-sm font-medium leading-tight truncate hover:text-primary transition-colors cursor-pointer",
            task.done && "line-through text-muted-foreground"
          )}
          onClick={(e) => { e.stopPropagation(); if (!isDragging) onOpen(); }}
          onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        >
          {task.title}
        </div>
        {(deadline || durationMinutes || task.category) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {durationMinutes && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5" />
                {formatDuration(durationMinutes)}
              </span>
            )}
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
      {task.done && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-urgency-low mt-0.5" />}
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
        "flex flex-col min-w-[150px] flex-1 rounded-2xl border border-border bg-card/60 overflow-hidden transition-[background-color,border-color,box-shadow] duration-150",
        today && "border-primary/30 bg-primary/[0.03]",
        isOver && "border-primary/45 bg-primary/[0.04] shadow-[0_0_0_2px_hsl(var(--primary)/0.12)]"
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          "flex flex-col items-center px-2 py-2.5 border-b border-border select-none",
          today ? "bg-primary/[0.04]" : "",
          isOver && "bg-primary/[0.05]"
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
          isOver && "bg-primary/[0.035]"
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
                  draggableId={`${item.data.id}@${dayKey}`}
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
  draggableId,
}: {
  task: TaskWithCategory;
  onOpen: () => void;
  draggableId?: string;
}) {
  const id = draggableId ?? task.id;
  const color = task.category?.color ?? "#6b7280";
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({ id, data: { task } });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        backgroundColor: `${color}18`,
        borderLeftColor: color,
        color,
      }}
      className={cn(
        "w-full min-h-6 rounded-md border border-transparent border-l-2 px-1.5 py-1 text-[11px] leading-tight shadow-sm",
        "touch-none select-none cursor-grab active:cursor-grabbing flex items-center gap-1 transition-[background-color,box-shadow,opacity]",
        "hover:shadow-md hover:bg-background/70",
        isDragging && "opacity-0"
      )}
    >
      <GripVertical
        className="w-2.5 h-2.5 shrink-0 opacity-45"
        style={{ color }}
      />
      <div
        role="button"
        tabIndex={0}
        className={cn("flex-1 min-w-0 text-left truncate cursor-pointer", task.done && "line-through opacity-60")}
        onClick={(e) => { e.stopPropagation(); if (!isDragging) onOpen(); }}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      >
        {task.title}
      </div>
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
        "min-h-[100px] sm:min-h-[118px] p-2 rounded-xl border transition-[background-color,border-color,box-shadow] duration-150",
        !inMonth && "opacity-35",
        today ? "bg-primary/[0.04] border-primary/30" : "border-border bg-card/50",
        isOver && "bg-primary/[0.05] border-primary/45 shadow-[0_0_0_2px_hsl(var(--primary)/0.10)]"
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
      <div className="space-y-1">
        {items.slice(0, 2).map((item, j) =>
          item.type === "task" ? (
            <DraggableTaskChip
              key={`mc-task-${item.data.id}-${j}`}
              task={item.data}
              draggableId={`${item.data.id}@${dayKey}`}
              onOpen={() => onOpenItem(item)}
            />
          ) : (
            <button
              key={`mc-sess-${item.data.id}-${j}`}
              onClick={() => onOpenItem(item)}
              className={cn(
                "w-full min-h-6 text-left px-1.5 py-1 rounded-md border border-transparent border-l-2 border-l-accent text-[11px] leading-tight truncate bg-accent/10 text-accent hover:bg-accent/20 shadow-sm transition-colors",
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
// Time blocks view — hour-slot droppable rows
// ─────────────────────────────────────────────────────────────────────────────

// Pure droppable row — no time label, no task rendering (events are in a separate layer)
function TimeSlot({
  dateKey,
  hour,
  minute,
}: {
  dateKey: string;
  hour: number;
  minute: number;
}) {
  const slotId = `${dateKey}T${slotKey(hour, minute)}`;
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const now = new Date();
  const isCurrent =
    dateKey === now.toLocaleDateString("sv-SE") &&
    hour === now.getHours() &&
    ((minute === 0 && now.getMinutes() < 30) || (minute === 30 && now.getMinutes() >= 30));
  const isHalf = minute === 30;

  return (
    <div
      ref={setNodeRef}
      style={{ height: SLOT_PX }}
      className={cn(
        "transition-[background-color,border-color,box-shadow]",
        isHalf ? "border-t border-dashed border-border/30" : "border-t border-border/60",
        isOver && "bg-primary/[0.045] shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.16)]",
        isCurrent && "border-primary/40"
      )}
    />
  );
}

function TimeBlocksView({
  currentDate,
  tasks,
  onOpenItem,
  onNavigate,
}: {
  currentDate: Date;
  tasks: TaskWithCategory[];
  onOpenItem: (item: CalendarItem) => void;
  onNavigate: (dir: -1 | 1) => void;
}) {
  const dateKey = currentDate.toLocaleDateString("sv-SE");
  const today = isToday(currentDate);
  const dayLabel = currentDate.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  // Tasks for this day, grouped by their deadline slot (30-min bucket).
  // Key format: "HH:MM" matching slotKey().
  const tasksBySlot = useMemo(() => {
    const map = new Map<string, TaskWithCategory[]>();
    BLOCK_SLOTS.forEach(s => map.set(slotKey(s.hour, s.minute), []));

    tasks.forEach(task => {
      if (!task.deadline) return;
      const base = new Date(task.deadline);
      const baseDateKey = base.toLocaleDateString("sv-SE");

      let appearsOnDate = baseDateKey === dateKey;
      if (!appearsOnDate && task.recurrence && task.recurrence !== "none") {
        const target = new Date(dateKey);
        const end = task.recurrenceEnd ? new Date(task.recurrenceEnd) : null;
        if (target >= base && (!end || target <= end)) {
          const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000);
          if (task.recurrence === "daily") appearsOnDate = true;
          else if (task.recurrence === "weekly" && diffDays % 7 === 0) appearsOnDate = true;
          else if (task.recurrence === "monthly" && target.getDate() === base.getDate()) appearsOnDate = true;
        }
      }
      if (!appearsOnDate) return;

      // Slot time comes from the original deadline (hours/minutes)
      let h = base.getHours();
      let m = base.getMinutes() < 30 ? 0 : 30;
      // Clamp out-of-range deadlines to the first/last visible slot
      const first = BLOCK_SLOTS[0];
      const last = BLOCK_SLOTS[BLOCK_SLOTS.length - 1];
      if (h < first.hour) { h = first.hour; m = first.minute; }
      else if (h > last.hour || (h === last.hour && m > last.minute)) { h = last.hour; m = last.minute; }
      const key = slotKey(h, m);
      map.set(key, [...(map.get(key) ?? []), task]);
    });

    return map;
  }, [tasks, dateKey]);

  // Google Calendar-style column positions for all events on this day
  const positionedTasks = useMemo(
    () => computeEventPositions(tasksBySlot),
    [tasksBySlot]
  );

  // Tasks with no deadline, shown in an "unscheduled" panel
  const unscheduled = tasks.filter(t => !t.deadline && !t.done).slice(0, 10);

  return (
    <div className="flex gap-4">
      {/* Day column */}
      <div className="flex-1 min-w-0">
        {/* Day header */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 rounded-xl border mb-4",
          today ? "bg-primary/5 border-primary/30" : "bg-card border-border"
        )}>
          <button onClick={() => onNavigate(-1)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className={cn("font-semibold capitalize", today && "text-primary")}>{dayLabel}</p>
            {today && <p className="text-xs text-primary/70 mt-0.5">Dzisiaj</p>}
          </div>
          <button onClick={() => onNavigate(1)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Time grid — two-column: labels | layered calendar area */}
        <div className="flex gap-3">
          {/* Time labels */}
          <div className="w-12 shrink-0 select-none">
            {BLOCK_SLOTS.map(({ hour, minute }) => {
              const now = new Date();
              const isCurrent =
                dateKey === now.toLocaleDateString("sv-SE") &&
                hour === now.getHours() &&
                ((minute === 0 && now.getMinutes() < 30) || (minute === 30 && now.getMinutes() >= 30));
              const isHalf = minute === 30;
              return (
                <div key={slotKey(hour, minute)} style={{ height: SLOT_PX }} className="flex items-start justify-end pr-1 pt-0.5">
                  <span className={cn(
                    "text-xs font-mono tabular-nums",
                    isCurrent ? "text-primary font-semibold" : isHalf ? "text-muted-foreground/30" : "text-muted-foreground/70"
                  )}>
                    {slotKey(hour, minute)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Calendar area: drop zones + events as separate layers */}
          <div className="flex-1 relative" style={{ height: BLOCK_SLOTS.length * SLOT_PX }}>
            {/* Drop zones layer */}
            {BLOCK_SLOTS.map(({ hour, minute }) => (
              <TimeSlot key={slotKey(hour, minute)} dateKey={dateKey} hour={hour} minute={minute} />
            ))}

            {/* Events layer — Google Calendar-style: overlapping events placed
                in adjacent columns proportional to the available width */}
            {positionedTasks.map(({ task, topPx, heightPx, leftFrac, widthFrac }) => (
              <div
                key={task.id}
                className="absolute"
                style={{
                  top: topPx,
                  height: heightPx,
                  // 2 px outer padding + proportional column position
                  left: `calc(${(leftFrac * 100).toFixed(3)}% + 2px)`,
                  // 4 px total horizontal gutter (2 px on each side of the block)
                  width: `calc(${(widthFrac * 100).toFixed(3)}% - 4px)`,
                  zIndex: 10,
                }}
              >
                <DraggableTaskCard
                  task={task}
                  durationMinutes={task.estimatedMinutes ?? undefined}
                  onOpen={() => onOpenItem({ type: "task", data: task })}
                  className="h-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unscheduled tasks sidebar */}
      <div className="w-52 shrink-0 hidden lg:block">
        <div className="bg-card border border-border rounded-xl p-3 sticky top-20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Niezaplanowane
          </p>
          {unscheduled.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">Brak zadań bez terminu</p>
          ) : (
            <div className="space-y-1.5">
              {unscheduled.map(task => (
                <DraggableTaskCard key={task.id} task={task} onOpen={() => onOpenItem({ type: "task", data: task })} />
              ))}
            </div>
          )}
        </div>
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
      className="flex w-[220px] max-w-[min(280px,calc(100vw-32px))] items-center gap-2 rounded-lg border border-primary/30 bg-background/95 px-3 py-2 text-sm font-medium shadow-2xl ring-1 ring-primary/15 backdrop-blur-sm cursor-grabbing"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: color,
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
      }}
    >
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
      <span className="truncate text-foreground">{task.title}</span>
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<UiTask | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [tasksRes, examsRes, catsRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/exams"),
      fetch("/api/categories"),
    ]);
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (examsRes.ok) setExams(await examsRes.json());
    if (catsRes.ok) setCategories(await catsRes.json());
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
    else if (viewMode === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goForward = () => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() + 7);
    else if (viewMode === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  // Pre-group all items by YYYY-MM-DD for O(1) day lookup (critical in 42-cell month grid)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    const addTask = (task: TaskWithCategory, date: Date) => {
      const key = date.toLocaleDateString("sv-SE");
      const list = map.get(key) ?? [];
      list.push({ type: "task", data: task });
      map.set(key, list);
    };

    // Cap expansion to 1 year from today to avoid unbounded maps for open-ended recurrences
    const MAX_DATE = new Date();
    MAX_DATE.setFullYear(MAX_DATE.getFullYear() + 1);

    tasks.forEach((task) => {
      if (!task.deadline) return;
      const base = new Date(task.deadline);

      if (!task.recurrence || task.recurrence === "none") {
        addTask(task, base);
        return;
      }

      const endDate = task.recurrenceEnd ? new Date(task.recurrenceEnd) : MAX_DATE;
      const cur = new Date(base);
      let count = 0;

      while (cur <= endDate && cur <= MAX_DATE && count < 365) {
        addTask(task, new Date(cur));
        count++;
        if (task.recurrence === "daily") cur.setDate(cur.getDate() + 1);
        else if (task.recurrence === "weekly") cur.setDate(cur.getDate() + 7);
        else if (task.recurrence === "monthly") cur.setMonth(cur.getMonth() + 1);
        else break;
      }
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

    const taskId = (active.id as string).split("@")[0];
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target date and hour.
    // over.id formats:
    //   "YYYY-MM-DD"      — day drop (week/month views) — preserve existing time or default 09:00
    //   "YYYY-MM-DDTHH"  — hour slot drop (blocks view) — set exact hour
    let newDeadline: Date;

    if (overId.includes("T")) {
      // Blocks view: "YYYY-MM-DDTHH:MM" (30-min granularity) or legacy "YYYY-MM-DDTHH"
      const [datePart, timePart] = overId.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const [hh, mm = "0"] = timePart.split(":");
      newDeadline = new Date(y, m - 1, d, Number(hh), Number(mm), 0, 0);
    } else {
      const [y, m, d] = overId.split("-").map(Number);
      newDeadline = new Date(y, m - 1, d);
      if (task.deadline) {
        const existing = new Date(task.deadline);
        newDeadline.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
      } else {
        newDeadline.setHours(9, 0, 0, 0);
      }
    }

    // Skip when nothing actually changes:
    // - Day-drop targets (no T in id) only care about the date
    // - Hour-drop targets care about minute precision too
    if (task.deadline) {
      const existing = new Date(task.deadline);
      const isHourDrop = overId.includes("T");
      if (isHourDrop) {
        if (
          existing.getTime() === newDeadline.getTime()
        ) return;
      } else if (sameDay(existing, newDeadline)) {
        return;
      }
    }

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

  const handleEditTask = (task: TaskWithCategory) => {
    setEditingTask(toUiTask(task));
    setSheetOpen(false);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<UiTask>) => {
    if (!taskData.id) return;
    const res = await fetch(`/api/tasks/${taskData.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskData.title,
        description: taskData.description,
        deadline: taskData.deadline?.toISOString(),
        priority: taskData.priority,
        categoryId: taskData.categoryId || null,
        recurrence: taskData.recurrence,
        recurrenceEnd: taskData.recurrenceEnd?.toISOString(),
        subtasks: taskData.subtasks,
        estimatedMinutes: taskData.estimatedMinutes ?? null,
      }),
    });
    if (res.ok) {
      const updated: TaskWithCategory = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedItem({ type: "task", data: updated });
      toast.success("Zadanie zaktualizowane");
    } else {
      toast.error("Nie udało się zaktualizować zadania");
    }
    setEditingTask(null);
  };

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId.split("@")[0]) ?? null : null;

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
              {(["week", "month", "blocks"] as const).map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    i > 0 && "border-l border-border",
                    viewMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {mode === "week" ? "Tydzień" : mode === "month" ? "Miesiąc" : "Bloki"}
                </button>
              ))}
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
          ) : viewMode === "blocks" ? (
            /* ── Blocks view — hour-slot day planner ── */
            <TimeBlocksView
              currentDate={currentDate}
              tasks={tasks}
              onOpenItem={openItem}
              onNavigate={(dir) => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + dir);
                setCurrentDate(d);
              }}
            />
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
          <DragOverlay dropAnimation={null} adjustScale={false}>
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
            <SheetHeader className="p-0 text-left flex-1">
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

          {selectedItem?.type === "task" && (
            <div className="px-6 py-4 border-t border-border">
              <Button
                className="w-full gap-2"
                onClick={() => handleEditTask(selectedItem.data)}
              >
                <Pencil className="h-4 w-4" />
                Edytuj zadanie
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={editingTask}
        categories={categories}
        onSave={handleSaveTask}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
      />
    </div>
  );
}
