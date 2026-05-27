import { z } from "zod";

const SubtaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
});

export const TaskCreateSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany"),
  description: z.string().optional(),
  deadline: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(5).default(3),
  categoryId: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrenceEnd: z.string().optional().nullable(),
  subtasks: z.array(SubtaskSchema).optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  actualMinutes: z.number().int().positive().optional().nullable(),
  intentionWhen: z.string().max(200).optional().nullable(),
  intentionWhere: z.string().max(200).optional().nullable(),
  isUrgent: z.boolean().default(false),
  isImportant: z.boolean().default(false),
  energyLevel: z.enum(["high", "low", "any"]).optional().nullable(),
});

export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  done: z.boolean().optional(),
  reminderSentAt: z.string().nullable().optional(),
});

export const WeeklyPlanSchema = z.object({
  weekStart: z.string().min(1, "Data tygodnia jest wymagana"),
  priority1: z.string().max(200).optional().nullable(),
  priority2: z.string().max(200).optional().nullable(),
  priority3: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const ExamCreateSchema = z.object({
  title: z.string().min(1, "Tytuł jest wymagany"),
  examDate: z.string().min(1, "Data egzaminu jest wymagana"),
  dailyHours: z.number().positive().default(1),
  topics: z.array(z.string()).default([]),
  categoryId: z.string().optional().nullable(),
  interleaved: z.boolean().default(false),
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

export const DeckCreateSchema = z.object({
  title: z.string().min(1, "Nazwa jest wymagana").max(60),
  emoji: z.string().default("📚"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7c5cff"),
});

export const FlashcardCreateSchema = z.object({
  front: z.string().min(1, "Pytanie jest wymagane").max(500),
  back: z.string().min(1, "Odpowiedź jest wymagana").max(1000),
});

export const ReviewSchema = z.object({
  cardId: z.string(),
  rating: z.number().int().min(1).max(4),
});
