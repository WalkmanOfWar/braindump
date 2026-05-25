"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wand2, Loader2, Plus, X, CheckCheck, Share2 } from "lucide-react";

interface ExtractedTask {
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
  parsed: ExtractedTask;
  status: "pending" | "accepted" | "rejected";
}

const PRIORITY_COLOR: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-urgency-low/15 text-urgency-low",
  3: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  4: "bg-urgency-high/15 text-urgency-high",
  5: "bg-destructive/15 text-destructive",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "znikomy",
  2: "niski",
  3: "średni",
  4: "wysoki",
  5: "krytyczny",
};

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingIds, setCreatingIds] = useState<Set<number>>(new Set());
  const [createdCount, setCreatedCount] = useState(0);
  const [autoAnalyzed, setAutoAnalyzed] = useState(false);

  // Compose shared payload from query params on mount
  useEffect(() => {
    const title = searchParams.get("title") ?? "";
    const sharedText = searchParams.get("text") ?? "";
    const url = searchParams.get("url") ?? "";

    const parts = [title, sharedText, url].filter(Boolean);
    const composed = parts.join("\n").trim();

    if (composed) setText(composed);
  }, [searchParams]);

  const handleAnalyze = async (currentText?: string) => {
    const payload = currentText ?? text;
    if (!payload.trim()) {
      toast.info("Brak tekstu do analizy");
      return;
    }
    setAnalyzing(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/extract-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Błąd AI");
        return;
      }

      const { tasks }: { tasks: ExtractedTask[] } = await res.json();
      if (tasks.length === 0) {
        toast.info("AI nie znalazł żadnych zadań w tym tekście");
      }
      setSuggestions(tasks.map((parsed, i) => ({ id: i, parsed, status: "pending" })));
    } finally {
      setAnalyzing(false);
    }
  };

  // Auto-analyze if shared payload came in
  useEffect(() => {
    if (text && !autoAnalyzed && !analyzing) {
      setAutoAnalyzed(true);
      handleAnalyze(text);
    }
  }, [text, autoAnalyzed]); // eslint-disable-line react-hooks/exhaustive-deps

  const createTask = async (card: SuggestionCard) => {
    setCreatingIds(prev => new Set([...prev, card.id]));
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
    setCreatingIds(prev => { const next = new Set(prev); next.delete(card.id); return next; });
    if (res.ok) {
      setSuggestions(prev => prev.map(s => s.id === card.id ? { ...s, status: "accepted" } : s));
      setCreatedCount(n => n + 1);
    } else {
      toast.error("Nie udało się dodać zadania");
    }
  };

  const reject = (id: number) => setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: "rejected" } : s));

  const createAll = async () => {
    for (const card of suggestions.filter(s => s.status === "pending")) {
      await createTask(card);
    }
  };

  const pendingCount = suggestions.filter(s => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Udostępniono do Brain Dump</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI znajduje wszystkie zadania w udostępnionym tekście.
            </p>
          </div>
        </div>

        {/* Shared content */}
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            placeholder="Wklej cokolwiek tutaj…"
            className="resize-none text-sm leading-relaxed"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {text.length} znaków
              {createdCount > 0 && (
                <span className="ml-2 text-urgency-low font-medium">
                  ✓ {createdCount} zadań dodano
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                <X className="w-4 h-4 mr-1" />
                Zamknij
              </Button>
              <Button
                onClick={() => handleAnalyze()}
                disabled={analyzing || !text.trim()}
                size="sm"
              >
                {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
                {analyzing ? "Analizuję…" : "Wyodrębnij zadania"}
              </Button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {analyzing && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {!analyzing && suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Znalezione zadania{" "}
                <span className="text-muted-foreground font-normal">({pendingCount} oczekujących)</span>
              </h2>
              {pendingCount > 1 && (
                <Button size="sm" variant="outline" onClick={createAll}>
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Dodaj wszystkie
                </Button>
              )}
            </div>

            {suggestions.map(card => {
              if (card.status === "rejected") return null;
              const p = card.parsed;
              const accepted = card.status === "accepted";
              const loading = creatingIds.has(card.id);

              return (
                <div
                  key={card.id}
                  className={`rounded-xl border p-3 ${
                    accepted
                      ? "border-urgency-low/30 bg-urgency-low/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{p.title}</p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant="outline" className={`text-xs ${PRIORITY_COLOR[p.priority]}`}>
                          P{p.priority} {PRIORITY_LABEL[p.priority]}
                        </Badge>
                        {p.deadline && (
                          <Badge variant="outline" className="text-xs">
                            📅 {new Date(p.deadline).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                          </Badge>
                        )}
                        {p.suggestedCategoryName && (
                          <Badge variant="outline" className="text-xs">
                            #{p.suggestedCategoryName}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!accepted && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => reject(card.id)} className="h-7 w-7 p-0">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => createTask(card)} disabled={loading} className="h-7 px-2">
                          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    )}
                    {accepted && (
                      <Badge variant="outline" className="bg-urgency-low/10 text-urgency-low border-urgency-low/30 text-xs">
                        Dodano
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            {createdCount > 0 && pendingCount === 0 && (
              <div className="text-center py-4">
                <Button onClick={() => router.push("/tasks")}>Zobacz zadania</Button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
}
