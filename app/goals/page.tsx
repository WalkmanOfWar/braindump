"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Target, Trash2, Pencil, CheckCircle2, Circle, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { GoalWithTasks } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJI_PRESETS = ["🎯", "🚀", "💪", "📚", "🏆", "💡", "🌟", "❤️", "🎨", "🧠", "💼", "🌱"];
const COLOR_PRESETS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

// ─── GoalModal ────────────────────────────────────────────────────────────────

interface GoalModalProps {
  open: boolean;
  initial?: Partial<GoalWithTasks>;
  onClose: () => void;
  onSave: (data: { title: string; description: string; emoji: string; color: string; deadline: string }) => Promise<void>;
}

function GoalModal({ open, initial, onClose, onSave }: GoalModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎯");
  const [color, setColor] = useState(initial?.color ?? "#3b82f6");
  const [deadline, setDeadline] = useState(
    initial?.deadline ? new Date(initial.deadline).toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setEmoji(initial?.emoji ?? "🎯");
      setColor(initial?.color ?? "#3b82f6");
      setDeadline(initial?.deadline ? new Date(initial.deadline).toISOString().slice(0, 10) : "");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), description, emoji, color, deadline });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial?.id ? "Edytuj cel" : "Nowy cel"}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Ikona</p>
            <div className="flex flex-wrap gap-2">
              {EMOJI_PRESETS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors",
                    emoji === e ? "border-primary bg-primary/10" : "border-transparent hover:border-border"
                  )}
                >{e}</button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nazwa celu</label>
            <Input
              className="mt-1"
              placeholder="np. Nauczyć się programować"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Opis (opcjonalnie)</label>
            <Textarea
              className="mt-1 resize-none"
              rows={2}
              placeholder="Dlaczego ten cel jest ważny?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Termin (opcjonalnie)</label>
            <Input
              className="mt-1"
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>

          {/* Color */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Kolor</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Anuluj</Button>
            <Button type="submit" className="flex-1" disabled={!title.trim() || saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: GoalWithTasks;
  onEdit: () => void;
  onDelete: () => void;
}

function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalTasks = goal.tasks.length;
  // tasks fetched are only undone ones — compute done count from all tasks if needed
  // Since API returns undone tasks only, we use a stored total approach:
  // For now treat returned tasks as remaining tasks
  const remainingTasks = goal.tasks.filter(t => !t.done).length;
  const doneTasks = totalTasks - remainingTasks;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const deadlineDate = goal.deadline
    ? new Date(goal.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const daysLeft = goal.deadline
    ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div
      className="bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderTopColor: goal.color, borderTopWidth: 3 }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{goal.emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
            )}
            {deadlineDate && (
              <div className={cn(
                "flex items-center gap-1 mt-1 text-xs",
                daysLeft !== null && daysLeft < 7 ? "text-destructive" : "text-muted-foreground"
              )}>
                <CalendarDays className="w-3 h-3" />
                {deadlineDate}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="ml-1">({daysLeft === 0 ? "dziś!" : `${daysLeft} dni`})</span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {totalTasks === 0 ? "Brak zadań" : `${doneTasks} / ${totalTasks} zadań`}
            </span>
            <span className="text-xs font-semibold" style={{ color: goal.color }}>{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: goal.color }}
            />
          </div>
        </div>
      </div>

      {/* Task list toggle */}
      {totalTasks > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 border-t border-border transition-colors"
          >
            <span>Powiązane zadania ({totalTasks})</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-1">
              {goal.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 py-1">
                  {task.done
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                  <span className={cn("text-sm", task.done && "line-through text-muted-foreground")}>{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {totalTasks === 0 && (
        <p className="px-4 pb-3 text-xs text-muted-foreground border-t border-border pt-2">
          Brak powiązanych zadań — przypisz zadania do tego celu w widoku zadań.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithTasks | null>(null);

  const fetchGoals = useCallback(async () => {
    const res = await fetch("/api/goals");
    if (res.ok) setGoals(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleSave = async (data: { title: string; description: string; emoji: string; color: string; deadline: string }) => {
    const isEditing = !!editingGoal;
    const url = isEditing ? `/api/goals/${editingGoal.id}` : "/api/goals";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error("Nie udało się zapisać celu");
      return;
    }

    const saved: GoalWithTasks = await res.json();

    setGoals(prev =>
      isEditing
        ? prev.map(g => g.id === saved.id ? saved : g)
        : [...prev, saved]
    );
    toast.success(isEditing ? "Cel zaktualizowany" : "Cel dodany!");
    setModalOpen(false);
    setEditingGoal(null);
  };

  const handleDelete = async (goal: GoalWithTasks) => {
    if (!confirm(`Usunąć cel „${goal.title}"? Powiązane zadania zostaną odłączone.`)) return;

    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (res.ok) {
      setGoals(prev => prev.filter(g => g.id !== goal.id));
      toast.success("Cel usunięty");
    } else {
      toast.error("Nie udało się usunąć celu");
    }
  };

  const openEdit = (goal: GoalWithTasks) => {
    setEditingGoal(goal);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditingGoal(null);
    setModalOpen(true);
  };

  const totalGoals = goals.length;
  const activeGoals = goals.filter(g => !g.archivedAt).length;

  return (
    <main className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Cele
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeGoals} {activeGoals === 1 ? "aktywny cel" : activeGoals < 5 ? "aktywne cele" : "aktywnych celów"}
            </p>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nowy cel
          </Button>
        </div>

        {/* Stats */}
        {totalGoals > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Wszystkich", value: totalGoals },
              { label: "Z zadaniami", value: goals.filter(g => g.tasks.length > 0).length },
              { label: "Ukończonych", value: goals.filter(g => g.tasks.length > 0 && g.tasks.every(t => t.done)).length },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Goals list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Brak celów</p>
            <p className="text-sm mt-1">Dodaj swój pierwszy cel długoterminowy</p>
            <Button onClick={openNew} className="mt-4 gap-1.5">
              <Plus className="w-4 h-4" />
              Dodaj cel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => openEdit(goal)}
                onDelete={() => handleDelete(goal)}
              />
            ))}
          </div>
        )}
      </div>

      <GoalModal
        open={modalOpen}
        initial={editingGoal ?? undefined}
        onClose={() => { setModalOpen(false); setEditingGoal(null); }}
        onSave={handleSave}
      />
    </main>
  );
}
