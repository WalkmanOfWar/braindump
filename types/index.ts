import type { Task, Exam, StudySession, Category, Habit, HabitCompletion, Goal } from "@prisma/client";

export type { Task, Exam, StudySession, Category, Habit, HabitCompletion, Goal };

export type HabitWithCompletions = Habit & { completions: HabitCompletion[] };

export type GoalWithTasks = Goal & { tasks: Task[] };

export type GoalCreateInput = {
  title: string;
  description?: string;
  emoji?: string;
  color?: string;
  deadline?: string;
};

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
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  done?: boolean;
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
