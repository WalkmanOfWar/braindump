"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, Flame, MoreVertical, Pencil, Trash2, Archive, Repeat2 } from "lucide-react";
import type { HabitWithCompletions } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString("sv-SE");
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("sv-SE");
  });
}

function calcStreak(completions: { date: string }[]): number {
  const datesSet = new Set(completions.map((c) => c.date));
  const today = todayStr();
  let streak = 0;
  const cur = new Date();

  // If today not done yet, start counting from yesterday
  if (!datesSet.has(today)) cur.setDate(cur.getDate() - 1);

  while (true) {
    const ds = cur.toLocaleDateString("sv-SE");
    if (!datesSet.has(ds)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
    if (streak > 365) break;
  }
  return streak;
}

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  // getDay(): 0=Sun … 6=Sat → convert to Mon-based index
  return DAY_LABELS[(d.getDay() + 6) % 7];
}

const EMOJI_OPTIONS = ["✅", "💪", "📚", "🏃", "💧", "🧘", "🎯", "🌱", "🛌", "🍎", "🧠", "✍️"];
const COLOR_OPTIONS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

// ─── HabitCard ────────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
}: {
  habit: HabitWithCompletions;
  onToggle: (habitId: string, date: string) => void;
  onEdit: (habit: HabitWithCompletions) => void;
  onArchive: (habitId: string) => void;
  onDelete: (habitId: string) => void;
}) {
  const today = todayStr();
  const completedSet = useMemo(
    () => new Set(habit.completions.map((c) => c.date)),
    [habit.completions]
  );
  const streak = useMemo(() => calcStreak(habit.completions), [habit.completions]);
  const last7 = useMemo(() => getLast7Days(), []);
  const doneToday = completedSet.has(today);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Today's big checkbox */}
        <button
          onClick={() => onToggle(habit.id, today)}
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all",
            doneToday
              ? "border-transparent text-white"
              : "border-border bg-background hover:border-primary/60"
          )}
          style={doneToday ? { backgroundColor: habit.color } : {}}
          title={doneToday ? "Odznacz" : "Zalicz dziś"}
        >
          {doneToday ? <span className="text-base">✓</span> : <span>{habit.emoji}</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">{habit.title}</span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-500">
                <Flame className="w-3 h-3" />
                {streak}
              </span>
            )}
          </div>
          {habit.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{habit.description}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(habit)}>
              <Pencil className="w-4 h-4 mr-2" /> Edytuj
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onArchive(habit.id)} className="text-muted-foreground">
              <Archive className="w-4 h-4 mr-2" /> Archiwizuj
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(habit.id)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Usuń
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 7-day grid */}
      <div className="flex gap-1">
        {last7.map((ds) => {
          const done = completedSet.has(ds);
          const isToday = ds === today;
          return (
            <button
              key={ds}
              onClick={() => onToggle(habit.id, ds)}
              className="flex-1 flex flex-col items-center gap-1"
              title={ds}
            >
              <span className="text-[10px] text-muted-foreground">{dayLabel(ds)}</span>
              <div
                className={cn(
                  "w-full aspect-square rounded-md transition-colors",
                  done ? "opacity-90" : "bg-muted/60",
                  isToday && !done && "ring-1 ring-primary/50"
                )}
                style={done ? { backgroundColor: habit.color } : {}}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── HabitModal ───────────────────────────────────────────────────────────────

function HabitModal({
  open,
  initialData,
  onClose,
  onSave,
}: {
  open: boolean;
  initialData: HabitWithCompletions | null;
  onClose: () => void;
  onSave: (data: { title: string; description: string; emoji: string; color: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [color, setColor] = useState("#3b82f6");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? "");
      setDescription(initialData?.description ?? "");
      setEmoji(initialData?.emoji ?? "✅");
      setColor(initialData?.color ?? "#3b82f6");
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), emoji, color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edytuj nawyk" : "Nowy nawyk"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji picker */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Ikona</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors",
                    emoji === e ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="habit-title" className="text-xs font-medium mb-1.5 block">
              Nazwa *
            </Label>
            <Input
              id="habit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Poranna medytacja"
              maxLength={100}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="habit-desc" className="text-xs font-medium mb-1.5 block">
              Opis (opcjonalnie)
            </Label>
            <Input
              id="habit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notatka do nawyku"
              maxLength={500}
            />
          </div>

          {/* Color */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Kolor</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-transform",
                    color === c && "ring-2 ring-offset-2 ring-primary scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
              Anuluj
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !title.trim()}>
              {saving ? "Zapisywanie…" : initialData ? "Zapisz" : "Dodaj nawyk"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithCompletions[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitWithCompletions | null>(null);

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch("/api/habits");
      if (res.ok) setHabits(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const today = todayStr();
  const doneToday = useMemo(
    () => habits.filter((h) => h.completions.some((c) => c.date === today)).length,
    [habits, today]
  );

  const handleToggle = useCallback(async (habitId: string, date: string) => {
    // Optimistic update
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const has = h.completions.some((c) => c.date === date);
        return {
          ...h,
          completions: has
            ? h.completions.filter((c) => c.date !== date)
            : [...h.completions, { id: `opt-${date}`, habitId, date }],
        };
      })
    );

    const res = await fetch(`/api/habits/${habitId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (!res.ok) {
      toast.error("Nie udało się zapisać");
      fetchHabits(); // revert
    }
  }, [fetchHabits]);

  const handleSave = async (data: { title: string; description: string; emoji: string; color: string }) => {
    if (editingHabit) {
      const res = await fetch(`/api/habits/${editingHabit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated: HabitWithCompletions = await res.json();
        setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        toast.success("Nawyk zaktualizowany");
      } else {
        toast.error("Nie udało się zapisać");
      }
    } else {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created: HabitWithCompletions = await res.json();
        setHabits((prev) => [...prev, created]);
        toast.success("Nawyk dodany!");
      } else {
        toast.error("Nie udało się dodać nawyku");
      }
    }
  };

  const handleArchive = async (habitId: string) => {
    const res = await fetch(`/api/habits/${habitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivedAt: new Date().toISOString() }),
    });
    if (res.ok) {
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      toast.success("Nawyk zarchiwizowany");
    } else {
      toast.error("Błąd archiwizacji");
    }
  };

  const handleDelete = async (habitId: string) => {
    const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
    if (res.ok) {
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      toast.success("Nawyk usunięty");
    } else {
      toast.error("Nie udało się usunąć");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <TopNavbar />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nawyki</h1>
            {!loading && habits.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Dziś: {doneToday}/{habits.length} zaliczonych
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => { setEditingHabit(null); setModalOpen(true); }}
          >
            <Plus className="w-4 h-4" />
            Nowy nawyk
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Repeat2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Brak nawyków</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Nawyki to małe działania powtarzane codziennie — budują trwałe zmiany.
              Zacznij od jednego.
            </p>
            <Button
              onClick={() => { setEditingHabit(null); setModalOpen(true); }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Dodaj pierwszy nawyk
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onToggle={handleToggle}
                onEdit={(h) => { setEditingHabit(h); setModalOpen(true); }}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <HabitModal
        open={modalOpen}
        initialData={editingHabit}
        onClose={() => { setModalOpen(false); setEditingHabit(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
