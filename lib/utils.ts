import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskWithCategory } from "@/types";
import type { UiTask, Recurrence, Subtask } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const daysBetween = (from: Date, to: Date) =>
  Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);

export const URGENCY_THRESHOLDS = {
  critical: 1,
  high: 3,
  medium: 7,
};

export function getDaysUntil(date: Date): number {
  return daysBetween(new Date(), date);
}

export function getUrgencyLevel(
  deadline: Date
): "critical" | "high" | "medium" | "low" {
  const diff = daysBetween(new Date(), deadline);
  if (diff <= URGENCY_THRESHOLDS.critical) return "critical";
  if (diff <= URGENCY_THRESHOLDS.high) return "high";
  if (diff <= URGENCY_THRESHOLDS.medium) return "medium";
  return "low";
}

export function getUrgencyColor(
  level: "critical" | "high" | "medium" | "low"
): string {
  return {
    critical: "#ff6b6b",
    high: "#ffa94d",
    medium: "#ffd43b",
    low: "#69db7c",
  }[level];
}

/** Returns today's date as "YYYY-MM-DD" in local time (sv-SE locale trick). */
export function getTodayStr(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** Returns any date as "YYYY-MM-DD" in local time — safe for string comparison. */
export function getDateStr(date: Date | string): string {
  return new Date(date).toLocaleDateString("sv-SE");
}

/** Canonical TaskWithCategory → UiTask mapper shared across all pages. */
export function toUiTask(t: TaskWithCategory): UiTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    deadline: t.deadline ? new Date(t.deadline) : new Date(),
    priority: t.priority,
    categoryId: t.categoryId ?? "",
    goalId: (t as TaskWithCategory & { goalId?: string | null }).goalId ?? null,
    completed: t.done,
    syncWithGoogle: !!t.googleEventId,
    recurrence: (t.recurrence ?? "none") as Recurrence,
    recurrenceEnd: t.recurrenceEnd ? new Date(t.recurrenceEnd) : undefined,
    subtasks: Array.isArray(t.subtasks) ? (t.subtasks as Subtask[]) : undefined,
    estimatedMinutes: t.estimatedMinutes ?? null,
    actualMinutes: t.actualMinutes ?? null,
    intentionWhen: t.intentionWhen ?? null,
    intentionWhere: t.intentionWhere ?? null,
    isUrgent: t.isUrgent,
    isImportant: t.isImportant,
    energyLevel: (t.energyLevel as import("@/types").EnergyLevel | null) ?? null,
  };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
