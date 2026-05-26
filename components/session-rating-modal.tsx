"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, BookOpen, Brain, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface SessionRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  sessionId: string;
  topic: string;
  examTitle: string;
  /** Called after successful save. retryCreated=true when a retry session was auto-added. */
  onComplete: (confidence: number, notes: string, retryCreated: boolean, retryTopic?: string) => void;
  /** Called when user wants to do the post-quiz right after rating */
  onStartQuiz: () => void;
}

const CONFIDENCE_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: "😞 Bardzo źle", color: "bg-red-500",    desc: "Prawie nic nie pamiętam" },
  2: { label: "😕 Słabo",      color: "bg-orange-500", desc: "Dużo luk w wiedzy" },
  3: { label: "😐 Średnio",    color: "bg-yellow-500", desc: "Rozumiem podstawy" },
  4: { label: "😊 Dobrze",     color: "bg-lime-500",   desc: "Czuję się pewnie" },
  5: { label: "🤩 Świetnie",   color: "bg-green-500",  desc: "Opanowałem temat" },
};

type Step = "rate" | "reflect" | "feedback";

export function SessionRatingModal({
  open,
  onOpenChange,
  examId,
  sessionId,
  topic,
  examTitle,
  onComplete,
  onStartQuiz,
}: SessionRatingModalProps) {
  const [confidence, setConfidence] = useState<number>(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<Step>("rate");
  const [savedConfidence, setSavedConfidence] = useState(3);
  const [savedRetryCreated, setSavedRetryCreated] = useState(false);
  const [savedRetryTopic, setSavedRetryTopic] = useState<string | undefined>();
  const [pendingQuiz, setPendingQuiz] = useState(false);

  const [reflection, setReflection] = useState("");
  const [reflectLoading, setReflectLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");

  const resetState = () => {
    setConfidence(3);
    setNotes("");
    setStep("rate");
    setReflection("");
    setAiFeedback("");
    setPendingQuiz(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  const handleSave = async (andQuiz = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${examId}/sessions/${sessionId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidence, notes: notes.trim() || undefined }),
      });

      if (!res.ok) {
        toast.error("Nie udało się zapisać oceny");
        return;
      }

      const data = await res.json() as { session: unknown; retrySession?: { topic: string } | null };
      const retryTopic = data.retrySession?.topic;

      setSavedConfidence(confidence);
      setSavedRetryCreated(!!data.retrySession);
      setSavedRetryTopic(retryTopic);
      setPendingQuiz(andQuiz);

      // Confidence >= 3 → invite to Feynman reflection
      if (confidence >= 3) {
        setStep("reflect");
      } else {
        onComplete(confidence, notes.trim(), !!data.retrySession, retryTopic);
        handleClose();
        if (andQuiz) onStartQuiz();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReflectSubmit = async () => {
    if (!reflection.trim()) return;
    setReflectLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/sessions/${sessionId}/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection: reflection.trim() }),
      });
      if (!res.ok) {
        toast.error("Nie udało się ocenić refleksji");
        return;
      }
      const data = await res.json() as { feedback: string };
      setAiFeedback(data.feedback);
      setStep("feedback");
    } finally {
      setReflectLoading(false);
    }
  };

  const handleSkipReflect = () => {
    onComplete(savedConfidence, notes.trim(), savedRetryCreated, savedRetryTopic);
    handleClose();
    if (pendingQuiz) onStartQuiz();
  };

  const handleFeedbackDone = () => {
    onComplete(savedConfidence, notes.trim(), savedRetryCreated, savedRetryTopic);
    handleClose();
    if (pendingQuiz) onStartQuiz();
  };

  const meta = CONFIDENCE_LABELS[confidence];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "rate" && <><BookOpen className="w-4 h-4 text-primary" />Jak poszła sesja?</>}
            {step === "reflect" && <><Brain className="w-4 h-4 text-primary" />Technika Feynmana</>}
            {step === "feedback" && <><Sparkles className="w-4 h-4 text-primary" />Ocena AI</>}
          </DialogTitle>
        </DialogHeader>

        {/* ─── Step 1: Rate ─────────────────────────────────────────────────── */}
        {step === "rate" && (
          <div className="py-2 space-y-5">
            <p className="text-sm text-muted-foreground truncate">
              <span className="font-medium text-foreground">{topic}</span>
              {" "}· {examTitle}
            </p>

            {/* Confidence picker */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Jak oceniasz swoją pewność po tej sesji?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setConfidence(level)}
                    className={cn(
                      "flex-1 h-10 rounded-lg border-2 text-lg transition-all",
                      confidence >= level
                        ? `${CONFIDENCE_LABELS[level].color} border-transparent text-white scale-105`
                        : "border-border bg-card hover:border-muted-foreground/40"
                    )}
                    aria-label={`Pewność ${level}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className={cn(
                "text-xs text-center font-medium transition-all",
                confidence <= 2 ? "text-destructive" : confidence === 3 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
              )}>
                {meta.label} — {meta.desc}
              </p>
            </div>

            {/* Low-confidence hint */}
            {confidence <= 2 && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 p-3">
                <RefreshCw className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Trudny temat! Jeśli jest czas, dodamy sesję powtórkową do planu.
                </p>
              </div>
            )}

            {/* High-confidence Feynman hint */}
            {confidence >= 3 && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80">
                  Świetnie! Po zapisaniu możesz wyjaśnić temat własnymi słowami — AI oceni Twoje rozumienie.
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Co było najtrudniejsze?{" "}
                <span className="text-muted-foreground font-normal">(opcjonalnie)</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="np. Nie rozumiałem pojęcia X, wzory były za skomplikowane..."
                rows={3}
                className="resize-none text-sm"
                maxLength={1000}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={() => handleSave(true)} disabled={saving} className="w-full gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Zapisz i zrób quiz sprawdzający
              </Button>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="w-full">
                Tylko zapisz ocenę
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Feynman reflection ───────────────────────────────────── */}
        {step === "reflect" && (
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Wyjaśnij <span className="font-medium text-foreground">{topic}</span> własnymi słowami, jakbyś tłumaczył komuś bez wiedzy z tej dziedziny. AI oceni Twoje rozumienie.
            </p>

            <Textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="np. Pochodna funkcji to miara jak szybko funkcja zmienia wartość. Jeśli f(x) = x², to f'(x) = 2x, czyli nachylenie stycznej..."
              rows={6}
              className="resize-none text-sm"
              maxLength={2000}
              autoFocus
            />

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleReflectSubmit}
                disabled={!reflection.trim() || reflectLoading}
                className="w-full gap-2"
              >
                {reflectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Wyślij do AI
              </Button>
              <Button variant="ghost" onClick={handleSkipReflect} className="w-full text-muted-foreground">
                Pomiń
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: AI feedback ──────────────────────────────────────────── */}
        {step === "feedback" && (
          <div className="py-2 space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="w-4 h-4" />
                Ocena AI
              </div>
              <p className="text-sm text-foreground leading-relaxed">{aiFeedback}</p>
            </div>

            <Button onClick={handleFeedbackDone} className="w-full">
              {pendingQuiz ? "Przejdź do quizu →" : "Zamknij"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
