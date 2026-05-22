"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  CheckSquare,
  GraduationCap,
  Calendar,
  BarChart2,
  Sun,
  CheckCircle2,
  Circle,
  BookOpen,
} from "lucide-react";
import type { TaskWithCategory, ExamWithSessions } from "@/types";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { href: "/today", label: "Dziś", icon: Sun, shortcut: "G T" },
  { href: "/tasks", label: "Zadania", icon: CheckSquare, shortcut: "2" },
  { href: "/exams", label: "Egzaminy", icon: GraduationCap, shortcut: "3" },
  { href: "/calendar", label: "Kalendarz", icon: Calendar, shortcut: "4" },
  { href: "/stats", label: "Statystyki", icon: BarChart2, shortcut: "5" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  // useRef (not useState) so the guard doesn't trigger re-renders or stale closures
  const loadedRef = useRef(false);
  const router = useRouter();

  // Cmd+K / Ctrl+K to open — intentionally uses a raw window listener instead of
  // useKeyboardShortcuts because the shared hook skips events from inputs/textareas,
  // but the palette must be openable from anywhere, including while the user is typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadData = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true; // set before await to prevent double-fetch on rapid open/close
    try {
      const [tasksRes, examsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/exams"),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (examsRes.ok) setExams(await examsRes.json());
    } catch {
      loadedRef.current = false; // allow retry on network error
    }
  }, []); // stable — ref mutations don't affect deps

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Reset loaded flag on close so data is fresh the next time the palette opens
    if (!next) loadedRef.current = false;
  };

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Memoized so these don't re-run on every keystroke (cmdk re-renders on input change)
  const activeTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.done).slice(0, 5), [tasks]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Szybkie wyszukiwanie"
      description="Przeszukaj zadania, egzaminy i strony"
    >
      <CommandInput placeholder="Szukaj zadań, egzaminów, stron…" />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Brak wyników dla tego zapytania.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Nawigacja">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <CommandItem
                key={link.href}
                value={`nawigacja ${link.label} ${link.href}`}
                onSelect={() => navigate(link.href)}
              >
                <Icon className="h-4 w-4" />
                {link.label}
                <CommandShortcut>{link.shortcut}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Aktywne zadania">
              {activeTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`zadanie aktywne ${task.title} ${task.description ?? ""}`}
                  onSelect={() => navigate("/tasks")}
                >
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{task.title}</span>
                  {task.deadline && (
                    <span className="ml-2 text-xs text-muted-foreground shrink-0">
                      {new Date(task.deadline).toLocaleDateString("pl-PL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                  {task.category && (
                    <span
                      className="ml-2 text-xs px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: `${task.category.color}20`,
                        color: task.category.color,
                      }}
                    >
                      {task.category.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ukończone zadania">
              {completedTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`zadanie ukonczone ${task.title}`}
                  onSelect={() => navigate("/tasks")}
                  className="opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--urgency-low))]" />
                  <span className="truncate line-through">{task.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Exams */}
        {exams.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Egzaminy">
              {exams.map((exam) => (
                <CommandItem
                  key={exam.id}
                  value={`egzamin ${exam.title}`}
                  onSelect={() => navigate("/exams")}
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{exam.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground shrink-0">
                    {new Date(exam.examDate).toLocaleDateString("pl-PL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
