import { z } from "zod";

export const TaskCreateSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany"),
  description: z.string().optional(),
  deadline: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(5).default(3),
  categoryId: z.string().optional().nullable(),
});

export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  done: z.boolean().optional(),
});

export const ExamCreateSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany"),
  examDate: z.string().min(1, "Data egzaminu jest wymagana"),
  dailyHours: z.number().positive().default(1),
  topics: z.array(z.string()).default([]),
  categoryId: z.string().optional().nullable(),
  today: z.string().optional(), // client's local date "YYYY-MM-DD" — prevents UTC offset bugs
});

export const CategoryCreateSchema = z.object({
  name: z.string().min(1, "Nazwa kategorii jest wymagana"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Nieprawidłowy kolor")
    .default("#888888"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Nieprawidłowy adres email"),
  password: z.string().min(6, "Hasło musi mieć minimum 6 znaków"),
  name: z.string().optional(),
});
