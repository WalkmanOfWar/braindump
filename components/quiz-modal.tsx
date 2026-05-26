"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Trophy } from "lucide-react";
import type { QuizQuestion } from "@/lib/claude";

interface QuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  sessionId?: string;
  topic: string;
  examTitle: string;
  type: "pre" | "post";
  onComplete?: (score: number, total: number) => void;
}

type Phase = "loading" | "question" | "revealed" | "result";

export function QuizModal({
  open,
  onOpenChange,
  examId,
  sessionId,
  topic,
  examTitle,
  type,
  onComplete,
}: QuizModalProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ questionIndex: number; answer: number }[]>([]);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadQuiz = useCallback(async () => {
    setPhase("loading");
    setError("");
    setCurrent(0);
    setSelected(null);
    setAnswers([]);
    setScore(0);

    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, examTitle, type, count: type === "pre" ? 3 : 5 }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Nie udało się wygenerować quizu");
        setPhase("result"); // show error state
        return;
      }

      const data = await res.json() as { questions: QuizQuestion[] };
      setQuestions(data.questions);
      setPhase("question");
    } catch {
      setError("Błąd połączenia z AI");
      setPhase("result");
    }
  }, [topic, examTitle, type]);

  useEffect(() => {
    if (open) loadQuiz();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = questions[current];
  const progress = questions.length > 0 ? ((current) / questions.length) * 100 : 0;

  const handleSelect = (idx: number) => {
    if (phase !== "question") return;
    setSelected(idx);
    setPhase("revealed");
  };

  const handleNext = () => {
    if (selected === null || !q) return;
    const isCorrect = selected === q.correct;
    const newAnswers = [...answers, { questionIndex: current, answer: selected }];
    const newScore = score + (isCorrect ? 1 : 0);

    if (current + 1 >= questions.length) {
      setAnswers(newAnswers);
      setScore(newScore);
      setPhase("result");
      saveResults(newAnswers, newScore);
    } else {
      setAnswers(newAnswers);
      setScore(newScore);
      setCurrent((c) => c + 1);
      setSelected(null);
      setPhase("question");
    }
  };

  const saveResults = async (
    finalAnswers: { questionIndex: number; answer: number }[],
    finalScore: number
  ) => {
    setSaving(true);
    try {
      await fetch(`/api/exams/${examId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          type,
          questions,
          answers: finalAnswers,
          score: finalScore,
        }),
      });
      onComplete?.(finalScore, questions.length);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const titleMap = { pre: "Pre-quiz — sprawdź co pamiętasz", post: "Quiz po sesji — utrwal wiedzę" };
  const scorePercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base">{titleMap[type]}</DialogTitle>
        </DialogHeader>

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI generuje pytania z tematu: <span className="font-medium text-foreground">{topic}</span></p>
          </div>
        )}

        {/* Question */}
        {(phase === "question" || phase === "revealed") && q && (
          <div className="space-y-4 py-2">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Pytanie {current + 1} z {questions.length}</span>
                <span>{score} pkt</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Question text */}
            <p className="font-medium text-sm leading-relaxed">{q.question}</p>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((opt, idx) => {
                const isSelected = selected === idx;
                const isCorrect = idx === q.correct;
                let variant = "option-default";
                if (phase === "revealed") {
                  if (isCorrect) variant = "option-correct";
                  else if (isSelected && !isCorrect) variant = "option-wrong";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    disabled={phase === "revealed"}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all",
                      variant === "option-default" && "border-border bg-card hover:border-primary hover:bg-primary/5",
                      variant === "option-correct" && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 font-medium",
                      variant === "option-wrong" && "border-destructive bg-destructive/10 text-destructive line-through",
                      phase === "question" && isSelected && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {phase === "revealed" && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                      {phase === "revealed" && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                      <span className="font-mono text-xs text-muted-foreground shrink-0">{String.fromCharCode(65 + idx)}.</span>
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Explanation after reveal */}
            {phase === "revealed" && (
              <div className="rounded-lg bg-muted/50 border border-border p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
              </div>
            )}

            {phase === "revealed" && (
              <Button onClick={handleNext} className="w-full">
                {current + 1 >= questions.length ? "Zobacz wynik" : "Następne pytanie →"}
              </Button>
            )}
          </div>
        )}

        {/* Result */}
        {phase === "result" && (
          <div className="py-4 space-y-5">
            {error ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={loadQuiz}>Spróbuj ponownie</Button>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="text-5xl">
                    {scorePercent >= 80 ? "🏆" : scorePercent >= 60 ? "👍" : "📚"}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-bold">{score}/{questions.length}</span>
                    <span className="text-muted-foreground">({scorePercent}%)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {scorePercent >= 80
                      ? "Świetnie! Dobrze opanowałeś ten materiał."
                      : scorePercent >= 60
                      ? "Nieźle. Warto przejrzeć słabsze punkty."
                      : "Materiał wymaga powtórki. Wróć do niego jutro."}
                  </p>
                </div>

                {/* Score breakdown */}
                <div className="flex gap-3 justify-center">
                  <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {score} poprawnych
                  </div>
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <XCircle className="w-4 h-4" />
                    {questions.length - score} błędnych
                  </div>
                </div>

                <Button
                  onClick={handleClose}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Zamknij
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
