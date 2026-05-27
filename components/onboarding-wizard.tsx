"use client";

import { useState } from "react";
import { CheckSquare, GraduationCap, Lightbulb, ArrowRight, X, Sparkles, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface StepProps {
  onNext: () => void;
  onSkip: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "welcome",        title: "Witaj w Brain Dump!" },
  { id: "first-task",     title: "Dodaj pierwsze zadanie" },
  { id: "first-exam",     title: "Zaplanuj egzamin" },
  { id: "first-flashcard",title: "Utwórz talię fiszek" },
  { id: "done",           title: "Gotowe!" },
] as const;

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: StepProps) {
  const features = [
    { icon: CheckSquare, color: "#3b82f6", label: "Zadania", desc: "Zarządzaj listą to-do z priorytetami" },
    { icon: GraduationCap, color: "#8b5cf6", label: "Egzaminy", desc: "Planuj naukę przed egzaminami" },
    { icon: Lightbulb, color: "#f59e0b", label: "Fiszki", desc: "Ucz się efektywnie z powtórkami SRS" },
  ];

  return (
    <div className="text-center">
      <div className="text-5xl mb-4">🧠</div>
      <h2 className="text-2xl font-bold mb-2">Witaj w Brain Dump!</h2>
      <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
        Twoje centrum produktywności. Mamy wszystko czego potrzebujesz żeby ogarnąć głowę.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {features.map(({ icon: Icon, color, label, desc }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-left">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      <Button onClick={onNext} className="w-full gap-2" size="lg">
        Zaczynamy!
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ─── Step 2: First Task ───────────────────────────────────────────────────────

function FirstTaskStep({ onNext, onSkip }: StepProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), priority: 3 }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Zadanie „${title}" dodane!`);
      onNext();
    } else {
      toast.error("Nie udało się dodać zadania");
    }
  };

  return (
    <div>
      <div className="text-4xl text-center mb-4">✅</div>
      <h2 className="text-xl font-bold text-center mb-1">Dodaj pierwsze zadanie</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Masz coś do zrobienia? Wpisz to poniżej.
      </p>

      <div className="space-y-3">
        <Input
          placeholder="np. Przeczytać rozdziały 3–5"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleCreate(); }}
          autoFocus
        />

        <Button
          onClick={handleCreate}
          disabled={!title.trim() || saving}
          className="w-full gap-2"
          size="lg"
        >
          {saving ? "Dodawanie…" : "Dodaj zadanie"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <button
        onClick={onSkip}
        className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        Pomiń ten krok
      </button>
    </div>
  );
}

// ─── Step 3: First Exam ───────────────────────────────────────────────────────

function FirstExamStep({ onNext, onSkip }: StepProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleCreate = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        examDate: new Date(date).toISOString(),
        dailyHours: 1,
        topics: [],
        today,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Egzamin „${title}" dodany z planem nauki!`);
      onNext();
    } else {
      toast.error("Nie udało się dodać egzaminu");
    }
  };

  return (
    <div>
      <div className="text-4xl text-center mb-4">🎓</div>
      <h2 className="text-xl font-bold text-center mb-1">Zaplanuj egzamin</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Podaj przedmiot i datę — wygenerujemy plan nauki.
      </p>

      <div className="space-y-3">
        <Input
          placeholder="np. Matematyka Analiza 2"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            className="pl-9"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <Button
          onClick={handleCreate}
          disabled={!title.trim() || !date || saving}
          className="w-full gap-2"
          size="lg"
        >
          {saving ? "Dodawanie…" : "Dodaj egzamin"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <button
        onClick={onSkip}
        className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        Pomiń ten krok
      </button>
    </div>
  );
}

// ─── Step 4: First Flashcard Deck ─────────────────────────────────────────────

function FirstFlashcardStep({ onNext, onSkip }: StepProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), emoji: "📚", color: "#7c5cff" }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Talia „${title}" utworzona!`);
      onNext();
    } else {
      toast.error("Nie udało się utworzyć talii");
    }
  };

  return (
    <div>
      <div className="text-4xl text-center mb-4">📚</div>
      <h2 className="text-xl font-bold text-center mb-1">Utwórz talię fiszek</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Fiszki z powtórkami SRS pomagają zapamiętać materiał na dłużej.
      </p>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 text-sm text-muted-foreground">
        💡 Możesz też wygenerować fiszki z egzaminu przy użyciu AI — wystarczy kilka kliknięć!
      </div>

      <div className="space-y-3">
        <Input
          placeholder="np. Anatomia, Wzory matematyczne…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleCreate(); }}
          autoFocus
        />

        <Button
          onClick={handleCreate}
          disabled={!title.trim() || saving}
          className="w-full gap-2"
          size="lg"
        >
          {saving ? "Tworzenie…" : "Utwórz talię"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <button
        onClick={onSkip}
        className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        Pomiń ten krok
      </button>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function DoneStep({ onNext }: StepProps) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">🚀</div>
      <h2 className="text-2xl font-bold mb-2">Jesteś gotowy!</h2>
      <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
        Możesz teraz eksplorować aplikację. Użyj{" "}
        <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
        {" "}aby szybko tworzyć zadania.
      </p>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-left space-y-2">
        {[
          '📌 Zacznij od zakładki "Dziś" — zobaczysz co masz na ten dzień',
          "🤖 Użyj AI na stronie zadań żeby posortować priorytety",
          "⏱️ Tryb skupienia pomaga pracować bez rozpraszaczy",
        ].map(tip => (
          <p key={tip} className="text-sm text-muted-foreground">{tip}</p>
        ))}
      </div>

      <Button onClick={onNext} className="w-full gap-2" size="lg">
        <Sparkles className="w-4 h-4" />
        Zaczynamy!
      </Button>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step >= STEPS.length - 1) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const skip = () => next();

  const stepProps: StepProps = { onNext: next, onSkip: skip };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 relative">
        {/* Skip all button */}
        {step > 0 && step < STEPS.length - 1 && (
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i === step ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && <WelcomeStep {...stepProps} />}
        {step === 1 && <FirstTaskStep {...stepProps} />}
        {step === 2 && <FirstExamStep {...stepProps} />}
        {step === 3 && <FirstFlashcardStep {...stepProps} />}
        {step === 4 && <DoneStep {...stepProps} />}
      </div>
    </div>
  );
}
