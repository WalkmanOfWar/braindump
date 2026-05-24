"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Plus, MoreHorizontal, Trash2, Pencil, Flame } from "lucide-react";
import { toast } from "sonner";
import type { HabitWithCompletions } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_EMOJIS = ["✅","🏃","📚","💪","🧘","🥗","💧","🎯","✍️","🎨","🎵","😴","🧹","💊","🌿"];
const PRESET_COLORS = ["#3b82f6","#22c55e","#f97316","#ef4444","#8b5cf6","#ec4899","#14b8a6","#eab308","#6b7280"];

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build array of last N days as YYYY-MM-DD strings, oldest first */
function buildHeatmapDates(weeks = 12): string[] {
  const today = new Date().toLocaleDateString("sv-SE");
  const dates: string[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString("sv-SE"));
  }
  return dates;
}

function computeStreak(completions: Set<string>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString("sv-SE");
    if (completions.has(key)) streak++;
    else if (i > 0) break; // gap found — stop counting
  }
  return streak;
}

// ─────────────────────────────────────────────────────────────────────────────
// HabitCard
// ─────────────────────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  today,
  heatmapDates,
  onToggle,
  onEdit,
  onDelete,
}: {
  habit: HabitWithCompletions;
  today: string;
  heatmapDates: string[];
  onToggle: (id: string) => void;
  onEdit: (habit: HabitWithCompletions) => void;
  onDelete: (id: string) => void;
}) {
  const doneSet = useMemo(
    () => new Set(habit.completions.map((c) => c.date)),
    [habit.completions]
  );
  const doneToday = doneSet.has(today);
  const streak = useMemo(() => computeStreak(doneSet), [doneSet]);

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <span className="text-2xl leading-none">{habit.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-none truncate">{habit.title}</p>
          {habit.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{habit.description}</p>
          )}
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center gap-1 text-amber-500 shrink-0">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold tabular-nums">{streak}</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(habit)}>
              <Pencil className="h-4 w-4 mr-2" />Edytuj
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(habit.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Usuń
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex items-center gap-4">
        {/* Today checkbox */}
        <button
          onClick={() => onToggle(habit.id)}
          className={cn(
            "w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all text-xl",
            doneToday
              ? "border-transparent text-white shadow-md"
              : "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
          )}
          style={doneToday ? { backgroundColor: habit.color } : {}}
          aria-label={doneToday ? "Odznacz" : "Odznacz jako zrobione"}
        >
          {doneToday ? "✓" : habit.emoji}
        </button>

        {/* Heatmap — 12 columns (weeks), 7 rows (days) */}
        <div
          className="grid gap-px overflow-hidden"
          style={{ gridTemplateColumns: `repeat(12, 1fr)`, gridTemplateRows: `repeat(7, 1fr)` }}
        >
          {heatmapDates.map((date) => {
            const done = doneSet.has(date);
            const isToday = date === today;
            return (
              <div
                key={date}
                title={date}
                className={cn(
                  "w-3 h-3 rounded-sm transition-colors",
                  isToday && "ring-1 ring-primary ring-offset-[1px]",
                  done ? "opacity-100" : "bg-muted opacity-60"
                )}
                style={done ? { backgroundColor: habit.color } : {}}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Habit modal
// ─────────────────────────────────────────────────────────────────────────────

function HabitModal({
  open,
  onOpenChange,
  habit,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: HabitWithCompletions | null;
  onSave: (data: { title: string; description: string; emoji: string; color: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [color, setColor] = useState("#3b82f6");

  useEffect(() => {
    if (habit) {
      setTitle(habit.title);
      setDescription(habit.description ?? "");
      setEmoji(habit.emoji);
      setColor(habit.color);
    } else {
      setTitle(""); setDescription(""); setEmoji("✅"); setColor("#3b82f6");
    }
  }, [habit, open]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), emoji, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{habit ? "Edytuj nawyk" : "Nowy nawyk"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Emoji picker */}
          <div className="space-y-2">
            <Label>Emoji</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors",
                    emoji === e ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="habit-title">Nazwa *</Label>
            <Input
              id="habit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Codzienne ćwiczenia"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="habit-desc">Opis (opcjonalnie)</Label>
            <Input
              id="habit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="np. 30 min cardio lub siłownia"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Kolor</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    outline: color === c ? `2px solid ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            {habit ? "Zapisz" : "Dodaj nawyk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithCompletions[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitWithCompletions | null>(null);

  const today = new Date().toLocaleDateString("sv-SE");
  const heatmapDates = useMemo(() => buildHeatmapDates(12), []);

  const fetchHabits = useCallback(async () => {
    const res = await fetch("/api/habits");
    if (res.ok) setHabits(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const handleToggle = async (id: string) => {
    // Optimistic update
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const alreadyDone = h.completions.some((c) => c.date === today);
        return {
          ...h,
          completions: alreadyDone
            ? h.completions.filter((c) => c.date !== today)
            : [...h.completions, { id: "tmp", habitId: id, date: today }],
        };
      })
    );

    const res = await fetch(`/api/habits/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    });

    if (!res.ok) {
      toast.error("Nie udało się zapisać");
      fetchHabits(); // rollback
    } else {
      const { done } = await res.json() as { done: boolean };
      toast.success(done ? "Nawyk odhaczony! 🔥" : "Odznaczono nawyk");
    }
  };

  const handleSave = async (data: { title: string; description: string; emoji: string; color: string }) => {
    if (editingHabit) {
      const res = await fetch(`/api/habits/${editingHabit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated: HabitWithCompletions = await res.json();
        setHabits((prev) => prev.map((h) => h.id === editingHabit.id ? updated : h));
        toast.success("Nawyk zaktualizowany");
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
      }
    }
    setEditingHabit(null);
  };

  const handleDelete = async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    await fetch(`/api/habits/${id}`, { method: "DELETE" });
    toast.success("Nawyk usunięty");
  };

  const openEdit = (habit: HabitWithCompletions) => {
    setEditingHabit(habit);
    setModalOpen(true);
  };

  const doneToday = habits.filter((h) => h.completions.some((c) => c.date === today)).length;
  const totalToday = habits.length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nawyki</h1>
            {!loading && totalToday > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {doneToday}/{totalToday} odhaczonych dziś
                {doneToday === totalToday && totalToday > 0 && " 🎉"}
              </p>
            )}
          </div>
          <Button
            onClick={() => { setEditingHabit(null); setModalOpen(true); }}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Dodaj nawyk
          </Button>
        </div>

        {/* Today's progress bar */}
        {totalToday > 0 && (
          <div className="mb-6">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(doneToday / totalToday) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Habit cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-3">🌱</p>
            <p className="font-medium">Brak nawyków</p>
            <p className="text-sm mt-1">Zacznij od czegoś małego — 5 minut dziennie zmienia wszystko</p>
            <Button
              onClick={() => setModalOpen(true)}
              variant="outline"
              className="mt-4 gap-1.5"
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
                today={today}
                heatmapDates={heatmapDates}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <HabitModal
        open={modalOpen}
        onOpenChange={(o) => { setModalOpen(o); if (!o) setEditingHabit(null); }}
        habit={editingHabit}
        onSave={handleSave}
      />
    </div>
  );
}
