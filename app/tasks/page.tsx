"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { TaskCard } from "@/components/task-card";
import { TaskModal } from "@/components/task-modal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardList, Sparkles } from "lucide-react";
import type { TaskWithCategory, Category } from "@/types";
import type { Task } from "@/lib/mock-data";

type FilterTab = "all" | "active" | "completed";
type SortOption = "deadline" | "priority";

function toUiTask(t: TaskWithCategory): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    deadline: t.deadline ? new Date(t.deadline) : new Date(),
    priority: t.priority,
    categoryId: t.categoryId ?? "osobiste",
    tags: t.tags,
    completed: t.done,
    syncWithGoogle: !!t.googleEventId,
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("deadline");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchCategories();
  }, [fetchTasks, fetchCategories]);

  const filtered = tasks
    .filter((t) => {
      if (filterTab === "active") return !t.done;
      if (filterTab === "completed") return t.done;
      return true;
    })
    .filter((t) =>
      categoryFilter === "all" ? true : t.categoryId === categoryFilter
    )
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
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async (taskData: Partial<Task>) => {
    if (taskData.id) {
      const res = await fetch(`/api/tasks/${taskData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description,
          deadline: taskData.deadline?.toISOString(),
          priority: taskData.priority,
          tags: taskData.tags,
          categoryId: taskData.categoryId || null,
        }),
      });
      if (res.ok) {
        const updated: TaskWithCategory = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskData.id ? updated : t))
        );
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
          tags: taskData.tags,
          categoryId: taskData.categoryId || null,
        }),
      });
      if (res.ok) {
        const created: TaskWithCategory = await res.json();
        setTasks((prev) => [...prev, created]);
        if (taskData.syncWithGoogle && created.deadline) {
          await fetch("/api/calendar/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "task", id: created.id, action: "create" }),
          });
        }
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
          title: t.title,
          deadline: t.deadline ? new Date(t.deadline).toISOString() : undefined,
        })),
      }),
    });
    if (res.ok) {
      const priorities: { title: string; priority: number }[] = await res.json();
      const updates = await Promise.all(
        priorities.map(async (p) => {
          const task = activeTasks.find((t) => t.title === p.title);
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
              disabled={aiLoading}
              title="Posortuj przez AI"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {aiLoading ? "AI…" : "AI"}
            </Button>
            <Button
              onClick={() => { setEditingTask(null); setModalOpen(true); }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
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

        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={toUiTask(task)}
                categoryOverride={task.category ?? null}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Brak zadań</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Dodaj pierwsze zadanie!
            </p>
            <Button
              onClick={() => { setEditingTask(null); setModalOpen(true); }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj zadanie
            </Button>
          </div>
        )}
      </main>

      <BottomNav />

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        categories={categories}
        onSave={handleSave}
      />
    </div>
  );
}
