import type { Task, Exam, StudySession, Category } from "@prisma/client";

export type { Task, Exam, StudySession, Category };

export type UiTask = {
  id: string;
  title: string;
  description?: string;
  deadline: Date;
  priority: number;
  categoryId: string;
  completed: boolean;
  syncWithGoogle: boolean;
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
