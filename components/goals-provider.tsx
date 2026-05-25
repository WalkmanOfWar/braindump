"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { Goal } from "@/types";

interface GoalsContextValue {
  goals: Goal[];
  getGoalInfo: (id: string | null | undefined) => { emoji: string; color: string; title: string } | null;
  refresh: () => Promise<void>;
}

const GoalsContext = createContext<GoalsContextValue>({
  goals: [],
  getGoalInfo: () => null,
  refresh: async () => {},
});

export function useGoals() {
  return useContext(GoalsContext);
}

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      if (res.ok) setGoals(await res.json());
    } catch {
      /* ignore — leave previous goals */
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const goalsById = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals]);

  const getGoalInfo = useCallback((id: string | null | undefined) => {
    if (!id) return null;
    const g = goalsById.get(id);
    if (!g) return null;
    return { emoji: g.emoji, color: g.color, title: g.title };
  }, [goalsById]);

  const value: GoalsContextValue = useMemo(
    () => ({ goals, getGoalInfo, refresh }),
    [goals, getGoalInfo, refresh]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}
