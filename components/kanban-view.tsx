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
import { getTodayStr, getDateStr, toUiTask } from "@/lib/utils";
import type { TaskWithCategory, UiTask } from "@/types";
import { AlarmClock, Sun, CalendarDays, Inbox, CheckCircle2, GripVertical } from "lucide-react";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  id: string;
  label: string;
  icon: React.ElementType;
  accent: string;
  pill: string;
  dropBg: string;
  cardBorder: string;
  emptyLabel: string;
  readonly?: boolean;   // cannot be a drop target
}

const COLUMNS: ColumnDef[] = [
  {
    id: "overdue",
    label: "Zaległe",
    icon: AlarmClock,
    accent: "text-destructive",
    pill: "bg-destructive/10 text-destructive",
    dropBg: "bg-destructive/5",
    cardBorder: "border-l-destructive",
    emptyLabel: "Brak zaległych",
    readonly: true,
  },
  {
    id: "today",
    label: "Dziś",
    icon: Sun,
    accent: "text-amber-500",
    pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dropBg: "bg-amber-500/5",
    cardBorder: "border-l-amber-500",
    emptyLabel: "Brak na dziś",
  },
  {
    id: "week",
    label: "Ten tydzień",
    icon: CalendarDays,
    accent: "text-primary",
    pill: "bg-primary/10 text-primary",
    dropBg: "bg-primary/5",
    cardBorder: "border-l-primary",
    emptyLabel: "Brak na ten tydzień",
  },
  {
    id: "upcoming",
    label: "Planowane",
    icon: Inbox,
    accent: "text-muted-foreground",
    pill: "bg-muted text-muted-foreground",
    dropBg: "bg-muted/40",
    cardBorder: "border-l-border",
    emptyLabel: "Brak planowanych",
  },
  {
    id: "done",
    label: "Ukończone",
    icon: CheckCircle2,
    accent: "text-urgency-low",
    pill: "bg-urgency-low/10 text-urgency-low",
    dropBg: "bg-urgency-low/5",
    cardBorder: "border-l-urgency-low",
    emptyLabel: "Brak ukończonych",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColumnForTask(task: TaskWithCategory, todayStr: string, weekEndStr: string): string {
  if (task.done) return "done";
  if (!task.deadline) return "upcoming";
  const ds = getDateStr(task.deadline);
  if (ds < todayStr) return "overdue";
  if (ds === todayStr) return "today";
  if (ds <= weekEndStr) return "week";
  return "upcoming";
}

function deadlineForColumn(columnId: string): string | null {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  if (columnId === "today") return d.toISOString();
  if (columnId === "week") { d.setDate(d.getDate() + 3); return d.toISOString(); }
  if (columnId === "upcoming") { d.setDate(d.getDate() + 14); return d.toISOString(); }
  return null;
}

// ---------------------------------------------------------------------------
// Draggable card
// ---------------------------------------------------------------------------

function KanbanCard({
  task,
  col,
  onEdit,
}: {
  task: TaskWithCategory;
  col: ColumnDef;
  onEdit: (task: UiTask) => void;
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
        "flex items-center gap-2 px-3 py-2.5 bg-card rounded-lg border border-l-[3px] shadow-sm",
        "touch-none select-none cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
        col.cardBorder,
        isDragging && "opacity-0"
      )}
    >
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />

      <div className="flex-1 min-w-0">
        <button
          className={cn(
            "text-sm font-medium text-left w-full truncate leading-tight transition-colors hover:text-primary",
            task.done && "line-through text-muted-foreground"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit(toUiTask(task))}
        >
          {task.title}
        </button>
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
// Droppable column
// ---------------------------------------------------------------------------

function KanbanColumn({
  col,
  tasks,
  onEdit,
}: {
  col: ColumnDef;
  tasks: TaskWithCategory[];
  onEdit: (task: UiTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const Icon = col.icon;
  const canDrop = !col.readonly;

  return (
    <div
      className={cn(
        "flex flex-col min-w-[200px] max-w-[260px] flex-1 rounded-2xl border border-border bg-card/60 overflow-hidden",
        isOver && canDrop && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center gap-2 px-3 py-2.5 border-b border-border", isOver && canDrop && col.dropBg)}>
        <span className={cn("flex items-center justify-center w-5 h-5 rounded-full shrink-0", col.pill)}>
          <Icon className="w-3 h-3" />
        </span>
        <p className={cn("text-xs font-semibold flex-1", col.accent)}>{col.label}</p>
        <span className="text-xs text-muted-foreground tabular-nums font-medium">{tasks.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[180px] p-2.5 space-y-2 transition-colors duration-150",
          isOver && canDrop && col.dropBg
        )}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[120px]">
            <p className="text-[11px] text-muted-foreground/50 select-none">
              {canDrop ? "Przeciągnij tutaj" : col.emptyLabel}
            </p>
          </div>
        ) : (
          tasks.map((t) => (
            <KanbanCard key={t.id} task={t} col={col} onEdit={onEdit} />
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
    <div className="flex items-center gap-2 px-3 py-2.5 bg-card rounded-lg border border-primary/40 shadow-2xl w-52 rotate-1">
      <GripVertical className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        {deadline && <p className="text-[11px] text-muted-foreground mt-0.5">{deadline}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface KanbanViewProps {
  tasks: TaskWithCategory[];
  onUpdate: (id: string, updates: { done?: boolean; deadline?: string | null }) => Promise<void>;
  onEdit: (task: UiTask) => void;
}

export function KanbanView({ tasks, onUpdate, onEdit }: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const todayStr = getTodayStr();
  const weekEndStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString("sv-SE");
  }, []);

  const columnMap = useMemo(() => {
    const map: Record<string, TaskWithCategory[]> = {
      overdue: [], today: [], week: [], upcoming: [], done: [],
    };
    tasks.forEach((t) => { map[getColumnForTask(t, todayStr, weekEndStr)].push(t); });
    return map;
  }, [tasks, todayStr, weekEndStr]);

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
    const targetCol = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentCol = getColumnForTask(task, todayStr, weekEndStr);
    if (currentCol === targetCol || targetCol === "overdue") return;

    if (targetCol === "done") {
      await onUpdate(taskId, { done: true });
    } else if (currentCol === "done") {
      await onUpdate(taskId, { done: false, deadline: deadlineForColumn(targetCol) });
    } else {
      const deadline = deadlineForColumn(targetCol);
      if (deadline) await onUpdate(taskId, { deadline });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={columnMap[col.id] ?? []}
            onEdit={onEdit}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        <DragOverlayCard task={activeTask} />
      </DragOverlay>
    </DndContext>
  );
}
