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
  Plus,
  Flame,
  CalendarDays,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskWithCategory, ExamWithSessions, Category } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard, shortcut: "1" },
  { href: "/today",      label: "Dziś",        icon: Sun,              shortcut: "T" },
  { href: "/tasks",      label: "Zadania",     icon: CheckSquare,      shortcut: "2" },
  { href: "/exams",      label: "Egzaminy",    icon: GraduationCap,    shortcut: "3" },
  { href: "/calendar",   label: "Kalendarz",   icon: Calendar,         shortcut: "4" },
  { href: "/stats",      label: "Statystyki",  icon: BarChart2,        shortcut: "5" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Quick-add parser
//
// Syntax (all optional, any order, case-insensitive):
//   !1–!5         → priority (default 3)
//   @dzis         → deadline = today 23:59
//   @jutro        → deadline = tomorrow 23:59
//   @pojutrze     → +2 days
//   @tydzien      → +7 days
//   @miesiac      → +30 days
//   #CategoryName → matched against loaded categories (prefix match)
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedTask {
  title: string;
  priority: number;
  deadline: Date | null;
  deadlineLabel: string | null;
  categoryId: string | null;
  categoryName: string | null;
}

const DEADLINE_SHORTCUTS: { key: string; days: number; label: string }[] = [
  { key: "@dzis",     days: 0,  label: "dziś"      },
  { key: "@jutro",    days: 1,  label: "jutro"     },
  { key: "@pojutrze", days: 2,  label: "pojutrze"  },
  { key: "@tydzien",  days: 7,  label: "za tydzień" },
  { key: "@miesiac",  days: 30, label: "za miesiąc" },
];

function makeDeadline(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 0, 0);
  return d;
}

function parseQuickAdd(query: string, categories: Category[]): ParsedTask {
  let title = query;
  let priority = 3;
  let deadline: Date | null = null;
  let deadlineLabel: string | null = null;
  let categoryId: string | null = null;
  let categoryName: string | null = null;

  // Priority: !1–!5
  const prioMatch = title.match(/![1-5]/);
  if (prioMatch) {
    priority = parseInt(prioMatch[0][1]);
    title = title.replace(prioMatch[0], "").trim();
  }

  // Deadline: @keyword
  for (const { key, days, label } of DEADLINE_SHORTCUTS) {
    if (title.toLowerCase().includes(key)) {
      deadline = makeDeadline(days);
      deadlineLabel = label;
      title = title.replace(new RegExp(key, "gi"), "").trim();
      break;
    }
  }

  // Category: #name (first prefix match)
  const catMatch = title.match(/#(\S+)/);
  if (catMatch) {
    const needle = catMatch[1].toLowerCase();
    const matched = categories.find((c) => c.name.toLowerCase().startsWith(needle));
    if (matched) {
      categoryId = matched.id;
      categoryName = matched.name;
    }
    title = title.replace(catMatch[0], "").trim();
  }

  // Collapse multiple spaces
  title = title.replace(/\s{2,}/g, " ").trim();

  return { title, priority, deadline, deadlineLabel, categoryId, categoryName };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creating, setCreating] = useState(false);
  // loadedRef prevents double-fetch on rapid open/close; not state so it doesn't trigger renders
  const loadedRef = useRef(false);
  const router = useRouter();

  // Cmd+K / Ctrl+K — raw window listener so it fires even while typing in inputs
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
    loadedRef.current = true;
    try {
      const [tasksRes, examsRes, catsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/exams"),
        fetch("/api/categories"),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (examsRes.ok) setExams(await examsRes.json());
      if (catsRes.ok)  setCategories(await catsRes.json());
    } catch {
      loadedRef.current = false; // allow retry on network error
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const close = () => {
    setOpen(false);
    setQuery("");
    loadedRef.current = false; // refresh data on next open
  };

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  // ── Quick-add ────────────────────────────────────────────────────────────

  const parsed = useMemo(() => parseQuickAdd(query, categories), [query, categories]);

  const handleCreate = useCallback(async () => {
    if (!parsed.title || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: parsed.title,
          priority: parsed.priority,
          deadline: parsed.deadline?.toISOString(),
          categoryId: parsed.categoryId ?? undefined,
        }),
      });
      if (res.ok) {
        toast.success(`Dodano: „${parsed.title}"`);
        close();
      } else {
        toast.error("Nie udało się dodać zadania");
      }
    } finally {
      setCreating(false);
    }
  }, [parsed, creating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived lists ────────────────────────────────────────────────────────

  const activeTasks    = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.done).slice(0, 5), [tasks]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => { if (!next) close(); else setOpen(true); }}
      title="Szybkie wyszukiwanie"
      description="Szukaj zadań, stron lub utwórz nowe zadanie"
    >
      <CommandInput
        placeholder="Szukaj lub wpisz zadanie (np. Zakupy !4 @jutro #Dom)…"
        value={query}
        onValueChange={setQuery}
      />

      <CommandList className="max-h-[420px]">
        <CommandEmpty>Brak wyników. Naciśnij Enter, aby dodać jako nowe zadanie.</CommandEmpty>

        {/* ── Quick-create (shown whenever query is non-empty) ── */}
        {query.trim().length > 0 && (
          <>
            <CommandGroup heading="Utwórz zadanie">
              <CommandItem
                value={`__create__ ${query}`}
                onSelect={handleCreate}
                disabled={creating || !parsed.title}
                className="gap-3"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 shrink-0">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {parsed.title || <span className="text-muted-foreground italic">wpisz tytuł…</span>}
                  </p>
                  {/* Meta chips */}
                  {(parsed.priority !== 3 || parsed.deadlineLabel || parsed.categoryName) && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {parsed.priority !== 3 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-destructive/10 text-destructive rounded px-1">
                          <Flame className="w-2.5 h-2.5" />
                          P{parsed.priority}
                        </span>
                      )}
                      {parsed.deadlineLabel && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded px-1">
                          <CalendarDays className="w-2.5 h-2.5" />
                          {parsed.deadlineLabel}
                        </span>
                      )}
                      {parsed.categoryName && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded px-1">
                          <Tag className="w-2.5 h-2.5" />
                          {parsed.categoryName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── Hint when query is empty ── */}
        {query.trim().length === 0 && (
          <CommandGroup heading="Skróty do dodawania">
            <CommandItem
              value="__hint_priority__"
              disabled
              className="opacity-50 text-xs cursor-default select-none"
            >
              <span className="font-mono bg-muted px-1 rounded">!1–!5</span>
              <span className="text-muted-foreground">priorytet</span>
              <span className="font-mono bg-muted px-1 rounded">@jutro</span>
              <span className="text-muted-foreground">termin</span>
              <span className="font-mono bg-muted px-1 rounded">#Kategoria</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* ── Navigation ── */}
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

        {/* ── Active tasks ── */}
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

        {/* ── Completed tasks ── */}
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

        {/* ── Exams ── */}
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

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground select-none">
        <span><kbd className="font-mono bg-muted px-1 rounded">↵</kbd> wybierz</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> nawiguj</span>
        <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> zamknij</span>
        <span className="ml-auto">
          <kbd className="font-mono bg-muted px-1 rounded">⌘K</kbd> otwórz/zamknij
        </span>
      </div>
    </CommandDialog>
  );
}
