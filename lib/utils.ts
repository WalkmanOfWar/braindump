import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
