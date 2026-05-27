import type { Task, Exam, StudySession, Category, FlashcardDeck, Flashcard, Quiz, WeeklyPlan, Habit, HabitCompletion } from "@prisma/client";

export type { Task, Exam, StudySession, Category, FlashcardDeck, Flashcard, Quiz, WeeklyPlan, Habit, HabitCompletion };

export type HabitWithCompletions = Habit & { completions: HabitCompletion[] };

export type EnergyLevel = "high" | "low" | "any";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type Subtask = {
  id: string;
  text: string;
  done: boolean;
};

export type UiTask = {
  id: string;
  title: string;
  description?: string;
  deadline: Date;
  priority: number;
  categoryId: string;
  goalId?: string | null;
  completed: boolean;
  syncWithGoogle: boolean;
  recurrence?: Recurrence;
  recurrenceEnd?: Date;
  subtasks?: Subtask[];
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  intentionWhen?: string | null;
  intentionWhere?: string | null;
  isUrgent?: boolean;
  isImportant?: boolean;
  energyLevel?: EnergyLevel | null;
};

export type TaskWithCategory = Task & {
  category: Category | null;
};

export type ExamWithSessions = Exam & {
  studySessions: StudySession[];
  category: Category | null;
};

export type TaskCreateInput = {
  title: string;
  description?: string;
  deadline?: string;
  priority?: number;
  categoryId?: string;
  recurrence?: Recurrence;
  recurrenceEnd?: string;
  subtasks?: Subtask[];
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  intentionWhen?: string | null;
  intentionWhere?: string | null;
  isUrgent?: boolean;
  isImportant?: boolean;
  energyLevel?: EnergyLevel | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  done?: boolean;
};

export type WeeklyPlanInput = {
  weekStart: string; // ISO date string (Monday)
  priority1?: string;
  priority2?: string;
  priority3?: string;
  notes?: string;
};

export type ExamCreateInput = {
  title: string;
  examDate: string;
  dailyHours?: number;
  topics?: string[];
  categoryId?: string;
};

export type CategoryCreateInput = {
  name: string;
  color?: string;
};

export type ApiError = {
  error: string;
};

export type FlashcardDeckWithStats = FlashcardDeck & {
  _count: { cards: number };
  dueCount: number;
  newCount: number;
  avgStability: number;
  recentReviews: string[];
};

export type FlashcardWithDeck = Flashcard & { deck: FlashcardDeck };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
