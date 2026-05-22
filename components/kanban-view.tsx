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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTodayStr, getDateStr } from "@/lib/utils";
import type { TaskWithCategory, UiTask } from "@/types";
import { AlarmClock, GripVertical } from "lucide-react";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  id: string;
  label: string;
  headerClass: string;
  emptyLabel: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "overdue",
    label: "Zaległe",
    headerClass: "text-destructive",
    emptyLabel: "Brak zaległych zadań",
  },
  {
    id: "today",
    label: "Dziś",
    headerClass: "text-amber-500",
    emptyLabel: "Brak zadań na dziś",
  },
  {
    id: "week",
    label: "Ten tydzień",
    headerClass: "text-primary",
    emptyLabel: "Brak zadań na ten tydzień",
  },
  {
    id: "upcoming",
    label: "Planowane",
    headerClass: "text-muted-foreground",
    emptyLabel: "Brak zaplanowanych zadań",
  },
  {
    id: "done",
    label: "Ukończone",
    headerClass: "text-urgency-low",
    emptyLabel: "Brak ukończonych zadań",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColumnForTask(
  task: TaskWithCategory,
  todayStr: string,
  weekEndStr: string
): string {
  if (task.done) return "done";
  if (!task.deadline) return "upcoming";
  const ds = getDateStr(task.deadline);
  if (ds < todayStr) return "overdue";
  if (ds === todayStr) return "today";
  if (ds <= weekEndStr) return "week";
  return "upcoming";
}

/** Returns the ISO deadline string to set when dropping onto a column, or null if no change needed. */
function deadlineForColumn(columnId: string): string | null {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  if (columnId === "today") return d.toISOString();
  if (columnId === "week") {
    d.setDate(d.getDate() + 3);
    return d.toISOString();
  }
  if (columnId === "upcoming") {
    d.setDate(d.getDate() + 14);
    return d.toISOString();
  }
  return null;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "znikomy",
  2: "niski",
  3: "średni",
  4: "wysoki",
  5: "krytyczny",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-urgency-low/15 text-urgency-low",
  3: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  4: "bg-urgency-high/15 text-urgency-high",
  5: "bg-destructive/15 text-destructive",
};

// ---------------------------------------------------------------------------
// Draggable task pill
// ---------------------------------------------------------------------------

function KanbanCard({
  task,
  onEdit,
}: {
  task: TaskWithCategory;
  onEdit: (task: UiTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "short",
      })
    : null;

  // Whole card is the drag surface (same pattern as calendar DraggableTaskPill)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform) ?? undefined }}
      className={cn(
        "flex items-start gap-2 p-3 bg-background rounded-lg border border-border text-sm",
        "touch-none select-none cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 ring-2 ring-primary shadow-lg"
      )}
    >
      {/* Decorative grip — not the drag handle, the whole card is */}
      <GripVertical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />

      <div className="flex-1 min-w-0">
        {/* Title is a button so clicking (without dragging) can open edit */}
        <button
          className={cn(
            "font-medium text-left w-full leading-snug truncate hover:text-primary transition-colors",
            task.done ? "line-through text-muted-foreground" : "text-foreground"
          )}
          // Stop the pointer event from triggering a drag; let it register as a click
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit({
            id: task.id, title: task.title, description: task.description ?? undefined,
            deadline: task.deadline ? new Date(task.deadline) : new Date(),
            priority: task.priority, categoryId: task.categoryId ?? "",
            completed: task.done, syncWithGoogle: !!task.googleEventId,
          })}
        >
          {task.title}
        </button>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {deadline && (
            <span className="text-xs text-muted-foreground">{deadline}</span>
          )}
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] px-1 py-0 h-4",
              PRIORITY_COLORS[task.priority]
            )}
          >
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          {task.category && (
            <span
              className="text-[10px] rounded px-1 py-0 h-4 inline-flex items-center font-medium"
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

  return (
    <div className="flex flex-col min-w-[220px] max-w-[280px] flex-1">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className={cn("text-xs font-semibold uppercase tracking-wide", col.headerClass)}>
          {col.label}
        </h3>
        <Badge variant="secondary" className="text-xs px-1.5 h-5">
          {tasks.length}
        </Badge>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[120px] rounded-xl border-2 border-dashed p-2 space-y-2 transition-colors",
          isOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card/50"
        )}
      >
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {col.emptyLabel}
          </p>
        ) : (
          tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay pill (shown while dragging)
// ---------------------------------------------------------------------------

function DragPreview({ task }: { task: TaskWithCategory | null }) {
  if (!task) return null;
  return (
    <div className="flex items-center gap-2 p-3 bg-card rounded-lg border border-primary shadow-xl text-sm w-52 opacity-95">
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="font-medium text-foreground truncate">{task.title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public props & main component
// ---------------------------------------------------------------------------

export interface KanbanViewProps {
  tasks: TaskWithCategory[];
  onUpdate: (
    id: string,
    updates: { done?: boolean; deadline?: string | null }
  ) => Promise<void>;
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

  // Group tasks into columns (memoised — avoids re-grouping on every drag event)
  const columnMap = useMemo(() => {
    const map: Record<string, TaskWithCategory[]> = {
      overdue: [],
      today: [],
      week: [],
      upcoming: [],
      done: [],
    };
    tasks.forEach((t) => {
      map[getColumnForTask(t, todayStr, weekEndStr)].push(t);
    });
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

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;

    const taskId = active.id as string;
    const targetCol = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentCol = getColumnForTask(task, todayStr, weekEndStr);
    if (currentCol === targetCol) return;

    // Cannot drag into "overdue" — that's read-only
    if (targetCol === "overdue") return;

    if (targetCol === "done") {
      await onUpdate(taskId, { done: true });
    } else if (currentCol === "done") {
      // Un-complete + move to target column
      const deadline = deadlineForColumn(targetCol);
      await onUpdate(taskId, { done: false, deadline });
    } else {
      const deadline = deadlineForColumn(targetCol);
      if (deadline) await onUpdate(taskId, { deadline });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Overdue warning banner */}
      {columnMap.overdue.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-1 text-destructive text-xs">
          <AlarmClock className="w-3.5 h-3.5 shrink-0" />
          <span>
            Masz {columnMap.overdue.length}{" "}
            {columnMap.overdue.length === 1 ? "zaległe zadanie" : "zaległych zadań"} — przeciągnij je do innej kolumny, aby je zaplanować.
          </span>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
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
        <DragPreview task={activeTask} />
      </DragOverlay>
    </DndContext>
  );
}
