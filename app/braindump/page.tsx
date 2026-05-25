"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  CheckCheck,
  X,
  ListTree,
  Wand2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

type Mode = "lines" | "smart";

interface ParsedSuggestion {
  title: string;
  description: string | null;
  deadline: string | null;
  priority: number;
  categoryId: string | null;
  goalId: string | null;
  suggestedCategoryName: string | null;
}

interface SuggestionCard {
  id: number;
  raw: string;
  parsed: ParsedSuggestion | null;
  status: "pending" | "accepted" | "rejected";
}

const PRIORITY_LABEL: Record<number, string> = {
  1: "znikomy",
  2: "niski",
  3: "średni",
  4: "wysoki",
  5: "krytyczny",
};

const PRIORITY_COLOR: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-urgency-low/15 text-urgency-low",
  3: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  4: "bg-urgency-high/15 text-urgency-high",
  5: "bg-destructive/15 text-destructive",
};

const PLACEHOLDER_LINES = `Wyrzuć tu wszystko co masz w głowie. Każda linia to osobne zadanie.

Przykłady:
zadzwonić do dentysty przed przyszłym tygodniem
naprawić cieknący kran, rodzice przyjeżdżają w piątek!
oddać referat z historii — ważne, do środy
kupić karmę dla kota
złożyć wniosek o stypendium — pilne, deadline jutro`;

const PLACEHOLDER_SMART = `Wklej tu cokolwiek — maila od szefa, notatki ze spotkania, fragment Slacka, wiadomość od znajomego. AI samodzielnie znajdzie wszystkie zadania ukryte w tekście.

Przykład — wklejony mail:
Cześć,
musisz ogarnąć kilka rzeczy przed konferencją. Zarezerwuj proszę hotel
do piątku, przygotuj prezentację na czwartek i nie zapomnij wysłać
materiałów do działu marketingu (najpóźniej środa). Dzięki!
Anna`;

export default function BrainDumpPage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("smart");
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creatingIds, setCreatingIds] = useState<Set<number>>(new Set());
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) {
      toast.info("Napisz coś przed analizą");
      return;
    }

    setAnalyzing(true);
    setSuggestions([]);

    try {
      if (mode === "smart") {
        // Smart extraction — AI finds action items in arbitrary prose
        const res = await fetch("/api/ai/extract-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (res.status === 503) {
          toast.error("Brak klucza ANTHROPIC_API_KEY — dodaj go do zmiennych środowiskowych");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error ?? "Błąd AI — spróbuj ponownie");
          return;
        }

        const { tasks }: { tasks: ParsedSuggestion[] } = await res.json();
        if (tasks.length === 0) {
          toast.info("AI nie znalazł żadnych zadań w tym tekście");
        }
        const cards: SuggestionCard[] = tasks.map((parsed, i) => ({
          id: i,
          raw: `(zadanie ${i + 1} z tekstu)`,
          parsed,
          status: "pending",
        }));
        setSuggestions(cards);
      } else {
        // Line-by-line mode (legacy)
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          toast.info("Napisz coś przed analizą");
          return;
        }

        const res = await fetch("/api/ai/batch-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines, categories }),
        });

        if (res.status === 503) {
          toast.error("Brak klucza ANTHROPIC_API_KEY — dodaj go do zmiennych środowiskowych");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error ?? "Błąd AI — spróbuj ponownie");
          return;
        }

        const parsed: (ParsedSuggestion | null)[] = await res.json();
        const cards: SuggestionCard[] = lines.map((raw, i) => ({
          id: i,
          raw,
          parsed: parsed[i] ?? null,
          status: "pending",
        }));
        setSuggestions(cards);
      }
    } finally {
      setAnalyzing(false);
    }
  }, [text, mode, categories]);

  const createTask = useCallback(
    async (card: SuggestionCard) => {
      if (!card.parsed) return;
      setCreatingIds((prev) => new Set([...prev, card.id]));

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: card.parsed.title,
          description: card.parsed.description,
          deadline: card.parsed.deadline,
          priority: card.parsed.priority,
          categoryId: card.parsed.categoryId || null,
          goalId: card.parsed.goalId || null,
        }),
      });

      setCreatingIds((prev) => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });

      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === card.id ? { ...s, status: "accepted" } : s))
        );
        setCreatedCount((n) => n + 1);
      } else {
        toast.error("Nie udało się dodać zadania");
      }
    },
    []
  );

  const rejectCard = (id: number) =>
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected" } : s))
    );

  const createAll = async () => {
    const pending = suggestions.filter(
      (s) => s.status === "pending" && s.parsed
    );
    for (const card of pending) {
      await createTask(card);
    }
  };

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const hasAnalyzed = suggestions.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Brain Dump</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wyrzuć wszystko z głowy — AI zamieni notatki w zadania.
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="smart" className="gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              Smart capture
            </TabsTrigger>
            <TabsTrigger value="lines" className="gap-1.5">
              <ListTree className="w-3.5 h-3.5" />
              Linie jako zadania
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className={cn(
          "rounded-lg border p-3 text-xs",
          mode === "smart"
            ? "bg-primary/5 border-primary/20 text-foreground/80"
            : "bg-muted border-border text-muted-foreground"
        )}>
          {mode === "smart"
            ? "Wklej cokolwiek — maila, notatki, wiadomość. AI znajdzie wszystkie action items, deadliny i priorytety. Idealne dla maili."
            : "Każda linia tekstu zostanie potraktowana jako osobne zadanie. Dobre dla szybkich list."
          }
        </div>

        {/* Scratchpad */}
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "smart" ? PLACEHOLDER_SMART : PLACEHOLDER_LINES}
            rows={10}
            className="resize-none font-mono text-sm leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAnalyze();
              }
            }}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {mode === "smart"
                ? `${text.length} znaków`
                : `${text.split("\n").filter((l) => l.trim()).length} linii`
              }
              {createdCount > 0 && (
                <span className="ml-2 text-urgency-low font-medium">
                  ✓ {createdCount} zadań dodano
                </span>
              )}
            </p>

            <div className="flex gap-2">
              {text && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText("");
                    setSuggestions([]);
                    setCreatedCount(0);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Wyczyść
                </Button>
              )}
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || !text.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analizuję…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analizuj z AI
                    <span className="ml-1.5 text-xs opacity-60">Ctrl+Enter</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {analyzing && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {hasAnalyzed && !analyzing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Sugestie AI{" "}
                <span className="text-muted-foreground font-normal">
                  ({pendingCount} oczekujących)
                </span>
              </h2>
              {pendingCount > 1 && (
                <Button size="sm" variant="outline" onClick={createAll}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Dodaj wszystkie
                </Button>
              )}
            </div>

            {suggestions.map((card) => {
              if (card.status === "rejected") return null;

              const p = card.parsed;
              const accepted = card.status === "accepted";
              const loading = creatingIds.has(card.id);

              return (
                <div
                  key={card.id}
                  className={`rounded-xl border p-4 transition-all ${
                    accepted
                      ? "border-urgency-low/50 bg-urgency-low/5 opacity-70"
                      : "border-border bg-card"
                  }`}
                >
                  {p ? (
                    <>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{p.title}</p>
                          {p.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.description}
                            </p>
                          )}
                        </div>
                        {accepted && (
                          <span className="text-urgency-low text-xs font-medium shrink-0">✓ Dodano</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${PRIORITY_COLOR[p.priority]}`}
                        >
                          {PRIORITY_LABEL[p.priority]}
                        </Badge>
                        {p.deadline && (
                          <span className="text-xs text-muted-foreground">
                            📅{" "}
                            {new Date(p.deadline).toLocaleDateString("pl-PL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                        {p.suggestedCategoryName && (
                          <span className="text-xs text-muted-foreground">
                            🏷 {p.suggestedCategoryName}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground italic">
                        Nie udało się sparsować: &ldquo;{card.raw}&rdquo;
                      </p>
                    </div>
                  )}

                  {!accepted && p && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => createTask(card)}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 mr-1" />
                        )}
                        Dodaj
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectCard(card.id)}
                        className="text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
