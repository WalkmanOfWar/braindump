"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { TaskCard } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardList, Sparkles, Search, AlertCircle, CheckSquare, Square, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useCalendarSync } from "@/hooks/use-calendar-sync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskWithCategory, Category, UiTask } from "@/types";

type FilterTab = "all" | "active" | "completed";
type SortOption = "deadline" | "priority";

function toUiTask(t: TaskWithCategory): UiTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    deadline: t.deadline ? new Date(t.deadline) : new Date(),
    priority: t.priority,
    categoryId: t.categoryId ?? "osobiste",
    completed: t.done,
    syncWithGoogle: !!t.googleEventId,
  };
}

function TaskSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card">
      <Skeleton className="w-4 h-4 rounded mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("deadline");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<UiTask | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const [tasksRes, catsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/categories"),
      ]);
      if (!tasksRes.ok || !catsRes.ok) throw new Error();
      setTasks(await tasksRes.json());
      setCategories(await catsRes.json());
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks
    .filter((t) => {
      if (filterTab === "active") return !t.done;
      if (filterTab === "completed") return t.done;
      return true;
    })
    .filter((t) =>
      categoryFilter === "all" ? true : t.categoryId === categoryFilter
    )
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "deadline") {
        const dA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const dB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return dA - dB;
      }
      return b.priority - a.priority;
    });

  const handleToggleComplete = async (id: string, completed: boolean) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: completed }),
    });
    if (res.ok) {
      const updated: TaskWithCategory = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      toast.success(completed ? "Zadanie ukończone!" : "Zadanie przywrócone");
    } else {
      toast.error("Nie udało się zaktualizować zadania");
    }
  };

  const handleEdit = (task: UiTask) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Zadanie usunięte");
    } else {
      toast.error("Nie udało się usunąć zadania");
    }
  };

  const handleSyncCalendar = useCalendarSync(setTasks);

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const handleBulkComplete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: true }),
        }).then((r) => (r.ok ? r.json() : null))
      )
    );
    setTasks((prev) =>
      prev.map((t) => results.find((r) => r?.id === t.id) ?? t)
    );
    setSelectedIds(new Set());
    const n = ids.length;
    toast.success(`${n} ${n === 1 ? "zadanie ukończone" : n < 5 ? "zadania ukończone" : "zadań ukończono"}`);
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })));
    setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    const n = ids.length;
    toast.success(`${n} ${n === 1 ? "zadanie usunięte" : n < 5 ? "zadania usunięte" : "zadań usuniętych"}`);
  };

  const handleSave = async (taskData: Partial<UiTask>) => {
    if (taskData.id) {
      const res = await fetch(`/api/tasks/${taskData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description,
          deadline: taskData.deadline?.toISOString(),
          priority: taskData.priority,
          categoryId: taskData.categoryId || null,
        }),
      });
      if (res.ok) {
        const updated: TaskWithCategory = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskData.id ? updated : t)));
        toast.success("Zadanie zaktualizowane");
      } else {
        toast.error("Nie udało się zaktualizować zadania");
      }
    } else {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description,
          deadline: taskData.deadline?.toISOString(),
          priority: taskData.priority,
          categoryId: taskData.categoryId || null,
        }),
      });
      if (res.ok) {
        const created: TaskWithCategory = await res.json();
        setTasks((prev) => [...prev, created]);
        toast.success("Zadanie dodane!");
        if (taskData.syncWithGoogle && created.deadline) {
          await fetch("/api/calendar/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "task", id: created.id, action: "create" }),
          });
        }
      } else {
        toast.error("Nie udało się dodać zadania");
      }
    }
    setEditingTask(null);
  };

  const handleAIPrioritize = async () => {
    const activeTasks = tasks.filter((t) => !t.done);
    if (!activeTasks.length) return;
    setAiLoading(true);
    const res = await fetch("/api/ai/prioritize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: activeTasks.map((t) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline ? new Date(t.deadline).toISOString() : undefined,
        })),
      }),
    });
    if (res.ok) {
      const priorities: { id: string; priority: number }[] = await res.json();
      const updates = await Promise.all(
        priorities.map(async (p) => {
          const task = activeTasks.find((t) => t.id === p.id);
          if (!task) return null;
          const r = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: p.priority }),
          });
          if (r.ok) return (await r.json()) as TaskWithCategory;
          return null;
        })
      );
      setTasks((prev) =>
        prev.map((t) => {
          const updated = updates.find((u) => u?.id === t.id);
          return updated ?? t;
        })
      );
      toast.success("Priorytety zaktualizowane przez AI");
    } else {
      toast.error("Błąd AI — spróbuj ponownie");
    }
    setAiLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Zadania</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIPrioritize}
              disabled={aiLoading || isLoading || selectionMode}
              title="Posortuj przez AI"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {aiLoading ? "AI…" : "AI"}
            </Button>
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
              disabled={isLoading || filtered.length === 0}
              title="Zaznacz zadania"
            >
              {selectionMode ? (
                <>
                  <Square className="h-4 w-4 mr-1" />
                  Anuluj
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Zaznacz
                </>
              )}
            </Button>
            {!selectionMode && (
              <Button
                onClick={() => { setEditingTask(null); setModalOpen(true); }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj zadanie
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj zadań…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Tabs
            value={filterTab}
            onValueChange={(v) => setFilterTab(v as FilterTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="all">Wszystkie</TabsTrigger>
              <TabsTrigger value="active">Aktywne</TabsTrigger>
              <TabsTrigger value="completed">Ukończone</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 flex-1 sm:flex-none">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Sortuj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline">Termin</SelectItem>
                <SelectItem value="priority">Priorytet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <TaskSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Nie udało się załadować zadań.{" "}
              <button
                onClick={() => { setIsError(false); setIsLoading(true); fetchTasks(); }}
                className="text-primary underline"
              >
                Spróbuj ponownie
              </button>
            </p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={toUiTask(task)}
                categoryOverride={task.category ?? null}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSyncCalendar={handleSyncCalendar}
                selectionMode={selectionMode}
                selected={selectedIds.has(task.id)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? "Brak wyników" : "Brak zadań"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? `Nie znaleziono zadań pasujących do "${searchQuery}"`
                : "Dodaj pierwsze zadanie!"}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => { setEditingTask(null); setModalOpen(true); }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj zadanie
              </Button>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Bulk action toolbar */}
      {selectionMode && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedIds.size === filtered.length && filtered.length > 0
                ? "Odznacz wszystkie"
                : "Zaznacz wszystkie"}
            </button>

            <span className="flex-1 text-sm text-center text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} zaznaczonych`
                : "Zaznacz zadania"}
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.size === 0}
              onClick={handleBulkComplete}
              className="gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Ukończ</span>
            </Button>

            <Button
              size="sm"
              variant="destructive"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Usuń</span>
            </Button>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zaznaczone zadania?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size === 1
                ? "Zaznaczone zadanie zostanie trwale usunięte."
                : `${selectedIds.size} zaznaczonych zadań zostanie trwale usuniętych.`}{" "}
              Tej akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        categories={categories}
        onSave={handleSave}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
      />
    </div>
  );
}
