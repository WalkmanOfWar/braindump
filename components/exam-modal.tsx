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
import type { Category } from "@/types";
import type { ExamWithSessions } from "@/types";

interface ExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: Category[];
  onSave: (exam: ExamWithSessions) => void;
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
  categories = [],
  onSave,
}: ExamModalProps) {
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [topics, setTopics] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setExamDate("");
      setHoursPerDay("1");
      setCategoryId("");
      setTopics("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim() || !examDate) return;
    setIsGenerating(true);
    setError("");

    const topicList = topics
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        examDate,
        dailyHours: parseFloat(hoursPerDay),
        topics: topicList,
        categoryId: categoryId || null,
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Dodaj egzamin</DialogTitle>
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

          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {isGenerating ? "Generowanie planu…" : "Generuj plan nauki"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
