"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTodayStr, getDateStr } from "@/lib/utils";
import type { TaskWithCategory, UiTask } from "@/types";
import { GripVertical } from "lucide-react";

// ---------------------------------------------------------------------------
// Quadrant definitions
// ---------------------------------------------------------------------------

interface Quadrant {
  id: string;
  label: string;
  action: string;
  urgent: boolean;
  important: boolean;
  border: string;
  bg: string;
  headerColor: string;
}

const QUADRANTS: Quadrant[] = [
  {
    id: "q1",
    label: "Zrób natychmiast",
    action: "Pilne + Ważne",
    urgent: true,
    important: true,
    border: "border-destructive/40",
    bg: "bg-destructive/5",
    headerColor: "text-destructive",
  },
  {
    id: "q2",
    label: "Zaplanuj",
    action: "Ważne + Niepilne",
    urgent: false,
    important: true,
    border: "border-primary/40",
    bg: "bg-primary/5",
    headerColor: "text-primary",
  },
  {
    id: "q3",
    label: "Deleguj",
    action: "Pilne + Nieważne",
    urgent: true,
    important: false,
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    headerColor: "text-amber-500",
  },
  {
    id: "q4",
    label: "Odrzuć lub zrób później",
    action: "Nieważne + Niepilne",
    urgent: false,
    important: false,
    border: "border-border",
    bg: "bg-muted/30",
    headerColor: "text-muted-foreground",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQuadrant(task: TaskWithCategory, todayStr: string): string {
  const daysUntil = task.deadline
    ? Math.ceil(
        (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const urgent = daysUntil !== null && daysUntil <= 3;
  const important = task.priority >= 4;

  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent && !important) return "q3";
  return "q4";
}

function updatesForQuadrant(
  quadrantId: string
): { priority: number; deadline?: string } {
  const d = new Date();
  d.setHours(23, 59, 0, 0);

  if (quadrantId === "q1") {
    d.setDate(d.getDate() + 2);
    return { priority: 5, deadline: d.toISOString() };
  }
  if (quadrantId === "q2") {
    d.setDate(d.getDate() + 14);
    return { priority: 4, deadline: d.toISOString() };
  }
  if (quadrantId === "q3") {
    d.setDate(d.getDate() + 2);
    return { priority: 2, deadline: d.toISOString() };
  }
  // q4
  return { priority: 1 };
}

// ---------------------------------------------------------------------------
// Draggable task card
// ---------------------------------------------------------------------------

function MatrixCard({ task }: { task: TaskWithCategory }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(
        "flex items-start gap-2 p-2.5 bg-background rounded-lg border border-border text-xs select-none cursor-default",
        isDragging && "opacity-40 ring-2 ring-primary"
      )}
    >
      <button
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Przeciągnij"
        tabIndex={-1}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground leading-snug line-clamp-2">
          {task.title}
        </p>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {deadline && (
            <span className="text-muted-foreground">{deadline}</span>
          )}
          {task.category && (
            <span
              className="rounded px-1 font-medium"
              style={{
                backgroundColor: `${task.category.color}20`,
                color: task.category.color,
              }}
            >
              {task.category.name}
            </span>
          )}
        </div>
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

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border-2 p-3 min-h-[200px] transition-colors",
        isOver ? "border-primary bg-primary/10" : `${q.border} ${q.bg}`
      )}
    >
      <div className="mb-2">
        <p className={cn("text-xs font-bold uppercase tracking-wide", q.headerColor)}>
          {q.label}
        </p>
        <p className="text-[10px] text-muted-foreground">{q.action}</p>
      </div>

      <div ref={setNodeRef} className="flex-1 space-y-1.5">
        {tasks.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4 italic">
            Przeciągnij tu zadania
          </p>
        ) : (
          tasks.map((t) => <MatrixCard key={t.id} task={t} />)
        )}
      </div>

      <div className="mt-2 text-right">
        <Badge variant="secondary" className="text-[10px] px-1 h-4">
          {tasks.length}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay
// ---------------------------------------------------------------------------

function DragPreview({ task }: { task: TaskWithCategory | null }) {
  if (!task) return null;
  return (
    <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border border-primary shadow-xl text-xs w-44 opacity-95">
      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="font-medium text-foreground truncate">{task.title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MatrixViewProps {
  tasks: TaskWithCategory[];
  onUpdate: (
    id: string,
    updates: { priority?: number; deadline?: string }
  ) => Promise<void>;
  onEdit: (task: UiTask) => void;
}

export function MatrixView({ tasks, onUpdate }: MatrixViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const todayStr = getTodayStr();

  const quadrantMap = useMemo(() => {
    const map: Record<string, TaskWithCategory[]> = {
      q1: [],
      q2: [],
      q3: [],
      q4: [],
    };
    // Only active tasks in the matrix
    tasks
      .filter((t) => !t.done)
      .forEach((t) => {
        map[getQuadrant(t, todayStr)].push(t);
      });
    return map;
  }, [tasks, todayStr]);

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.id === activeId) ?? null : null),
    [activeId, tasks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }: DragStartEvent) =>
    setActiveId(active.id as string);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;

    const taskId = active.id as string;
    const targetQ = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentQ = getQuadrant(task, todayStr);
    if (currentQ === targetQ) return;

    await onUpdate(taskId, updatesForQuadrant(targetQ));
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUADRANTS.map((q) => (
          <MatrixQuadrant key={q.id} q={q} tasks={quadrantMap[q.id] ?? []} />
        ))}
      </div>

      {/* Axis labels — desktop only */}
      <div className="hidden sm:flex items-center justify-between mt-2 px-1 text-[10px] text-muted-foreground">
        <span>← Mniej ważne</span>
        <span>Ważniejsze →</span>
      </div>

      <DragOverlay dropAnimation={null}>
        <DragPreview task={activeTask} />
      </DragOverlay>
    </DndContext>
  );
}
