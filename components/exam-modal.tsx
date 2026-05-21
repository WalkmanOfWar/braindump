"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Check } from "lucide-react";
import type { Category } from "@/types";
import type { ExamWithSessions } from "@/types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#000000",
];

interface ExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam?: ExamWithSessions | null;   // if provided → edit mode
  categories?: Category[];
  onSave: (exam: ExamWithSessions) => void;
  onCategoryCreated?: (category: Category) => void;
}

const hoursOptions = [
  { value: "0.5", label: "0.5h" },
  { value: "1", label: "1h" },
  { value: "1.5", label: "1.5h" },
  { value: "2", label: "2h" },
  { value: "3", label: "3h" },
];

export function ExamModal({
  open,
  onOpenChange,
  exam,
  categories = [],
  onSave,
  onCategoryCreated,
}: ExamModalProps) {
  const isEditing = !!exam;

  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [topics, setTopics] = useState("");
  const [regenerate, setRegenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // Nowa kategoria — inline
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");
  const [newCatLoading, setNewCatLoading] = useState(false);

  useEffect(() => {
    if (open && exam) {
      setTitle(exam.title);
      setExamDate(new Date(exam.examDate).toISOString().split("T")[0]);
      setHoursPerDay(String(exam.dailyHours));
      setCategoryId(exam.categoryId ?? "");
      // rebuild topics from existing sessions (unique, in order)
      const uniqueTopics = [...new Set(exam.studySessions.map((s) => s.topic))];
      setTopics(uniqueTopics.join("\n"));
      setRegenerate(false);
    } else if (!open) {
      setTitle("");
      setExamDate("");
      setHoursPerDay("1");
      setCategoryId("");
      setTopics("");
      setRegenerate(false);
      setError("");
      setShowNewCategory(false);
      setNewCatName("");
      setNewCatColor("#3b82f6");
    }
  }, [open, exam]);

  const handleCategoryChange = (value: string) => {
    if (value === "__new__") {
      setShowNewCategory(true);
      setCategoryId("");
    } else {
      setShowNewCategory(false);
      setCategoryId(value);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setNewCatLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    });
    setNewCatLoading(false);
    if (res.ok) {
      const created: Category = await res.json();
      onCategoryCreated?.(created);
      setCategoryId(created.id);
      setShowNewCategory(false);
      setNewCatName("");
      setNewCatColor("#3b82f6");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !examDate) return;
    setIsGenerating(true);
    setError("");

    const topicList = topics
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    const todayStr = new Date().toLocaleDateString("sv-SE");

    if (isEditing && exam) {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          examDate,
          dailyHours: parseFloat(hoursPerDay),
          categoryId: categoryId || null,
          regenerate,
          topics: topicList,
          today: todayStr,
        }),
      });
      setIsGenerating(false);
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Błąd aktualizacji egzaminu");
        return;
      }
      const updated: ExamWithSessions = await res.json();
      onSave(updated);
    } else {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          examDate,
          dailyHours: parseFloat(hoursPerDay),
          topics: topicList,
          categoryId: categoryId || null,
          today: todayStr,
        }),
      });
      setIsGenerating(false);
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Błąd tworzenia egzaminu");
        return;
      }
      const created: ExamWithSessions = await res.json();
      onSave(created);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj egzamin" : "Dodaj egzamin"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exam-title">Tytuł egzaminu *</Label>
            <Input
              id="exam-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Egzamin z Matematyki"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-date">Data egzaminu *</Label>
            <Input
              id="exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Ile godzin dziennie możesz się uczyć?</Label>
            <div className="flex gap-2 flex-wrap">
              {hoursOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={hoursPerDay === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHoursPerDay(option.value)}
                  className={cn(
                    "px-4",
                    hoursPerDay === option.value &&
                      "bg-primary text-primary-foreground"
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategoria</Label>
            <Select
              value={showNewCategory ? "__new__" : categoryId}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię">
                  {!showNewCategory && categoryId && (() => {
                    const cat = categories.find((c) => c.id === categoryId);
                    return cat ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    ) : null;
                  })()}
                  {showNewCategory && (
                    <span className="text-muted-foreground">Nowa kategoria…</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  <div className="flex items-center gap-2 text-primary">
                    <Plus className="w-3 h-3" />
                    Dodaj nową kategorię
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {showNewCategory && (
              <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                <Input
                  placeholder="Nazwa kategorii..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                  autoFocus
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Kolor</p>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCatColor(color)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: color,
                          borderColor: newCatColor === color ? "white" : "transparent",
                          outline: newCatColor === color ? `2px solid ${color}` : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={!newCatName.trim() || newCatLoading}
                    className="flex-1"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    {newCatLoading ? "Tworzenie…" : "Utwórz"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowNewCategory(false); setCategoryId(""); }}
                  >
                    Anuluj
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="topics">
              Tematy do nauki{" "}
              <span className="text-muted-foreground">(opcjonalnie, jeden na linię)</span>
            </Label>
            <Textarea
              id="topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder={"Pochodne i całki\nMacierze\nRównania różniczkowe"}
              rows={4}
            />
          </div>

          {isEditing && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <input
                type="checkbox"
                id="regenerate"
                checked={regenerate}
                onChange={(e) => setRegenerate(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <label htmlFor="regenerate" className="text-sm cursor-pointer select-none">
                Przelicz plan nauki od nowa (usuń stare sesje)
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !examDate || isGenerating}
            className="bg-primary text-primary-foreground"
          >
            {isGenerating
              ? isEditing ? "Zapisywanie…" : "Generowanie planu…"
              : isEditing ? "Zapisz zmiany" : "Generuj plan nauki"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
