"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { TaskWithCategory } from "@/types";

const REMIND_BEFORE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Checks every 60 s whether any task deadline is within 1 hour.
 * Uses a ref for the task list so the interval is created once — no re-subscribe on every render.
 * Notified IDs are tracked in a ref so each task fires at most one toast per mount.
 */
export function useDeadlineReminders(tasks: TaskWithCategory[]) {
  const notifiedRef = useRef<Set<string>>(new Set());
  // Keep the ref current without adding tasks to the interval dep array
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      tasksRef.current.forEach((task) => {
        if (task.done || !task.deadline || notifiedRef.current.has(task.id)) return;
        const deadline = new Date(task.deadline).getTime();
        const diff = deadline - now;
        if (diff > 0 && diff <= REMIND_BEFORE_MS) {
          notifiedRef.current.add(task.id);
          const minutes = Math.round(diff / 60_000);
          toast.warning(`⏰ Zbliża się termin: „${task.title}" — za ${minutes} min`, {
            duration: 8_000,
          });
        }
      });
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []); // interval created once — reads from tasksRef
}
