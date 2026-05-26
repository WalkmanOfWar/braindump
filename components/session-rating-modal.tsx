"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, BookOpen } from "lucide-react";
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

      onComplete(confidence, notes.trim(), !!data.retrySession, retryTopic);
      onOpenChange(false);
      // Reset for next use
      setConfidence(3);
      setNotes("");

      if (andQuiz) onStartQuiz();
    } finally {
      setSaving(false);
    }
  };

  const meta = CONFIDENCE_LABELS[confidence];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Jak poszła sesja?
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-5">
          <div>
            <p className="text-sm text-muted-foreground mb-1 truncate">
              <span className="font-medium text-foreground">{topic}</span>
              {" "}· {examTitle}
            </p>
          </div>

          {/* Confidence stars */}
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

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Co było najtrudniejsze? <span className="text-muted-foreground font-normal">(opcjonalnie)</span></label>
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
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Zapisz i zrób quiz sprawdzający
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full"
            >
              Tylko zapisz ocenę
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
