"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Brain, Lightbulb, Play, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionPrepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  examTitle: string;
  /** Called when the user clicks "Zacznij naukę" */
  onStart: () => void;
}

export function SessionPrepModal({
  open,
  onOpenChange,
  topic,
  examTitle,
  onStart,
}: SessionPrepModalProps) {
  const [recall, setRecall] = useState("");
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [examples, setExamples] = useState<string[]>([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);

  const reset = () => {
    setRecall("");
    setPromptsOpen(false);
    setPromptsLoading(false);
    setQuestions([]);
    setExamples([]);
    setPromptsLoaded(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const handleStart = () => {
    onStart();
    handleClose();
  };

  const loadPrompts = async () => {
    if (promptsLoaded) {
      setPromptsOpen((v) => !v);
      return;
    }
    setPromptsOpen(true);
    setPromptsLoading(true);
    try {
      const res = await fetch("/api/ai/study-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, examTitle }),
      });
      if (res.ok) {
        const data = await res.json() as { questions: string[]; examples: string[] };
        setQuestions(data.questions ?? []);
        setExamples(data.examples ?? []);
        setPromptsLoaded(true);
      }
    } finally {
      setPromptsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Przygotowanie do nauki
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Topic */}
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Temat</p>
            <p className="font-medium text-foreground">{topic}</p>
            <p className="text-xs text-muted-foreground">{examTitle}</p>
          </div>

          {/* Active Recall */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              Co już wiesz o tym temacie?
              <span className="text-muted-foreground font-normal text-xs">(opcjonalnie)</span>
            </label>
            <Textarea
              value={recall}
              onChange={(e) => setRecall(e.target.value)}
              placeholder="Napisz bez zaglądania do notatek — nawet niekompletne wspomnienia wzmacniają zapamiętywanie..."
              rows={4}
              className="resize-none text-sm"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Technika Pre-Testing Effect — samo próbowanie przypomnienia, nawet nieudane, znacząco poprawia późniejsze zapamiętywanie nowego materiału.
            </p>
          </div>

          {/* AI Prompts: Elaborative Interrogation + Concrete Examples */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={loadPrompts}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                Pytania AI i przykłady
                <span className="text-xs text-muted-foreground font-normal">Elaborative Interrogation</span>
              </span>
              {promptsLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                : promptsOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>

            {promptsOpen && !promptsLoading && (
              <div className="px-4 pb-4 space-y-4 border-t border-border bg-muted/20">
                {questions.length > 0 && (
                  <div className="space-y-2 pt-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pytania do przemyślenia</p>
                    <ul className="space-y-1.5">
                      {questions.map((q, i) => (
                        <li key={i} className={cn("text-sm flex gap-2")}>
                          <span className="text-primary font-mono shrink-0 text-xs mt-0.5">{i + 1}.</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {examples.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Przykłady z życia</p>
                    <ul className="space-y-1.5">
                      {examples.map((ex, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="shrink-0">💡</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Start button */}
          <Button onClick={handleStart} className="w-full gap-2">
            <Play className="w-4 h-4" />
            Zacznij naukę
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
