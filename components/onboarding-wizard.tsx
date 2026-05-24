"use client";

import { useState } from "react";
import { CheckSquare, GraduationCap, Repeat2, Target, ArrowRight, X, Sparkles } from "lucide-react";
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
  { id: "welcome", title: "Witaj w Brain Dump!" },
  { id: "first-task", title: "Dodaj pierwsze zadanie" },
  { id: "first-goal", title: "Wyznacz swój cel" },
  { id: "done", title: "Gotowe!" },
] as const;

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: StepProps) {
  const features = [
    { icon: CheckSquare, color: "#3b82f6", label: "Zadania", desc: "Zarządzaj listą to-do z priorytetami" },
    { icon: GraduationCap, color: "#8b5cf6", label: "Egzaminy", desc: "Planuj naukę przed egzaminami" },
    { icon: Repeat2, color: "#10b981", label: "Nawyki", desc: "Buduj dobre nawyki dzień po dniu" },
    { icon: Target, color: "#f59e0b", label: "Cele", desc: "Wyznaczaj i śledź długoterminowe cele" },
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
      toast.success(`Zadanie "${title}" dodane!`);
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
          placeholder="np. Przeczytać rozdziały 3-5"
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

// ─── Step 3: First Goal ───────────────────────────────────────────────────────

function FirstGoalStep({ onNext, onSkip }: StepProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = ["Zdać wszystkie egzaminy", "Nauczyć się nowego języka", "Skończyć projekt semestralny", "Regularnie ćwiczyć"];

  const handleCreate = async (goalTitle: string) => {
    if (!goalTitle.trim()) return;
    setSaving(true);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: goalTitle.trim(), emoji: "🎯", color: "#3b82f6" }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Cel "${goalTitle}" dodany!`);
      onNext();
    } else {
      toast.error("Nie udało się dodać celu");
    }
  };

  return (
    <div>
      <div className="text-4xl text-center mb-4">🎯</div>
      <h2 className="text-xl font-bold text-center mb-1">Wyznacz swój cel</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Cele pomagają skupić się na tym co naprawdę ważne.
      </p>

      <div className="space-y-2 mb-4">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => setTitle(s)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors",
              title === s
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border hover:border-primary/40 text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <Input
        placeholder="Lub wpisz własny cel…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleCreate(title); }}
        className="mb-3"
      />

      <Button
        onClick={() => handleCreate(title)}
        disabled={!title.trim() || saving}
        className="w-full gap-2"
        size="lg"
      >
        {saving ? "Dodawanie…" : "Dodaj cel"}
        <ArrowRight className="w-4 h-4" />
      </Button>

      <button
        onClick={onSkip}
        className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        Pomiń ten krok
      </button>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

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
          "📌 Zacznij od zakładki \"Dziś\" — zobaczysz co masz na ten dzień",
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
        {step === 2 && <FirstGoalStep {...stepProps} />}
        {step === 3 && <DoneStep {...stepProps} />}
      </div>
    </div>
  );
}
