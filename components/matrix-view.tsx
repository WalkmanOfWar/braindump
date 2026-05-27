"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { getTodayStr } from "@/lib/utils";
import type { TaskWithCategory, UiTask } from "@/types";
import { GripVertical, Zap, Calendar, ArrowRight, Archive } from "lucide-react";

// ---------------------------------------------------------------------------
// Quadrant definitions
// ---------------------------------------------------------------------------

interface Quadrant {
  id: string;
  num: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  accent: string;          // tailwind text color
  pill: string;            // header pill bg + text
  dropBg: string;          // active drop background
  cardBorder: string;      // left border on card
}

const QUADRANTS: Quadrant[] = [
  {
    id: "q1",
    num: "I",
    label: "Zrób natychmiast",
    sub: "Pilne i ważne",
    icon: Zap,
    accent: "text-destructive",
    pill: "bg-destructive/10 text-destructive",
    dropBg: "bg-destructive/8",
    cardBorder: "border-l-destructive",
  },
  {
    id: "q2",
    num: "II",
    label: "Zaplanuj",
    sub: "Ważne, niepilne",
    icon: Calendar,
    accent: "text-primary",
    pill: "bg-primary/10 text-primary",
    dropBg: "bg-primary/8",
    cardBorder: "border-l-primary",
  },
  {
    id: "q3",
    num: "III",
    label: "Deleguj",
    sub: "Pilne, mniej ważne",
    icon: ArrowRight,
    accent: "text-amber-500",
    pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dropBg: "bg-amber-500/8",
    cardBorder: "border-l-amber-500",
  },
  {
    id: "q4",
    num: "IV",
    label: "Odrzuć lub przełóż",
    sub: "Niepilne i mniej ważne",
    icon: Archive,
    accent: "text-muted-foreground",
    pill: "bg-muted text-muted-foreground",
    dropBg: "bg-muted/60",
    cardBorder: "border-l-border",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQuadrant(task: TaskWithCategory): string {
  // Prefer explicit Eisenhower fields set by the user
  if (task.isUrgent !== undefined && task.isImportant !== undefined) {
    if (task.isUrgent && task.isImportant) return "q1";
    if (!task.isUrgent && task.isImportant) return "q2";
    if (task.isUrgent && !task.isImportant) return "q3";
    return "q4";
  }
  // Fallback heuristic: deadline ≤ 3 days = urgent, priority ≥ 4 = important
  const daysUntil = task.deadline
    ? Math.ceil((new Date(task.deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const urgent = daysUntil !== null && daysUntil <= 3;
  const important = task.priority >= 4;
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent && !important) return "q3";
  return "q4";
}

function updatesForQuadrant(id: string): { priority: number; deadline?: string; isUrgent: boolean; isImportant: boolean } {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  if (id === "q1") { d.setDate(d.getDate() + 2); return { priority: 5, deadline: d.toISOString(), isUrgent: true, isImportant: true }; }
  if (id === "q2") { d.setDate(d.getDate() + 14); return { priority: 4, deadline: d.toISOString(), isUrgent: false, isImportant: true }; }
  if (id === "q3") { d.setDate(d.getDate() + 2); return { priority: 2, deadline: d.toISOString(), isUrgent: true, isImportant: false }; }
  return { priority: 1, isUrgent: false, isImportant: false };
}

// ---------------------------------------------------------------------------
// Draggable card
// ---------------------------------------------------------------------------

function MatrixCard({
  task,
  cardBorder,
}: {
  task: TaskWithCategory;
  cardBorder: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform) ?? undefined }}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 bg-card rounded-lg border border-l-[3px] shadow-sm text-sm",
        "touch-none select-none cursor-grab active:cursor-grabbing transition-shadow",
        "hover:shadow-md",
        cardBorder,
        isDragging && "opacity-0"
      )}
    >
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate leading-tight">{task.title}</p>
        {(deadline || task.category) && (
          <div className="flex items-center gap-2 mt-0.5">
            {deadline && (
              <span className="text-[11px] text-muted-foreground">{deadline}</span>
            )}
            {task.category && (
              <span
                className="text-[11px] font-medium rounded px-1"
                style={{ backgroundColor: `${task.category.color}20`, color: task.category.color }}
              >
                {task.category.name}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable quadrant
// ---------------------------------------------------------------------------

function MatrixQuadrant({
  q,
  tasks,
}: {
  q: Quadrant;
  tasks: TaskWithCategory[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: q.id });
  const Icon = q.icon;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card/60 overflow-hidden transition-all duration-150",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Header strip */}
      <div className={cn("flex items-center gap-2.5 px-4 py-3 border-b border-border", isOver && q.dropBg)}>
        <span className={cn("flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0", q.pill)}>
          {q.num}
        </span>
        <Icon className={cn("w-4 h-4 shrink-0", q.accent)} />
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold leading-none", q.accent)}>{q.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{q.sub}</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground font-medium tabular-nums">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[140px] p-3 space-y-2 transition-colors duration-150",
          isOver && q.dropBg
        )}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[100px]">
            <p className="text-xs text-muted-foreground/50 select-none">
              Przeciągnij zadanie tutaj
            </p>
          </div>
        ) : (
          tasks.map((t) => (
            <MatrixCard key={t.id} task={t} cardBorder={q.cardBorder} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay
// ---------------------------------------------------------------------------

function DragOverlayCard({ task }: { task: TaskWithCategory | null }) {
  if (!task) return null;
  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-card rounded-lg border border-primary/40 shadow-2xl text-sm w-56 rotate-1">
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{task.title}</p>
        {deadline && <p className="text-[11px] text-muted-foreground mt-0.5">{deadline}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface MatrixViewProps {
  tasks: TaskWithCategory[];
  onUpdate: (id: string, updates: { priority?: number; deadline?: string | null; isUrgent?: boolean; isImportant?: boolean }) => Promise<void>;
  onEdit: (task: UiTask) => void;
}

export function MatrixView({ tasks, onUpdate }: MatrixViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const todayStr = getTodayStr();

  const quadrantMap = useMemo(() => {
    const map: Record<string, TaskWithCategory[]> = { q1: [], q2: [], q3: [], q4: [] };
    tasks.filter((t) => !t.done).forEach((t) => { map[getQuadrant(t)].push(t); });
    return map;
  }, [tasks, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.id === activeId) ?? null : null),
    [activeId, tasks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const taskId = active.id as string;
    const targetQ = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (getQuadrant(task) === targetQ) return;
    await onUpdate(taskId, updatesForQuadrant(targetQ));
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Axis labels */}
      <div className="hidden sm:grid grid-cols-2 gap-3 mb-1 px-1">
        <p className="text-[11px] text-muted-foreground text-center">⚡ Pilne</p>
        <p className="text-[11px] text-muted-foreground text-center">🕐 Niepilne</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Row 1: Q1 (urgent+important) | Q2 (not-urgent+important) */}
        <MatrixQuadrant q={QUADRANTS[0]} tasks={quadrantMap.q1} />
        <MatrixQuadrant q={QUADRANTS[1]} tasks={quadrantMap.q2} />
        {/* Row 2: Q3 (urgent+not-important) | Q4 (not-urgent+not-important) */}
        <MatrixQuadrant q={QUADRANTS[2]} tasks={quadrantMap.q3} />
        <MatrixQuadrant q={QUADRANTS[3]} tasks={quadrantMap.q4} />
      </div>

      <DragOverlay dropAnimation={null}>
        <DragOverlayCard task={activeTask} />
      </DragOverlay>
    </DndContext>
  );
}
