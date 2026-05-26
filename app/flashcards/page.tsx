"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lightbulb, Plus, MoreHorizontal, Trash2, Pencil, Sparkles, X, ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNextInterval } from "@/lib/fsrs";
import type { FlashcardDeckWithStats, Flashcard } from "@/types";
import { toast } from "sonner";

// ─── EMOJI PICKER ──────────────────────────────────────────────────────────────
const EMOJIS = ["📚", "🧠", "🔬", "📐", "🌍", "🎵", "💻", "⚗️", "📜", "🗺️", "🏛️", "🌱"];
const COLORS = ["#7c5cff", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

// ─── RATING BUTTONS ────────────────────────────────────────────────────────────
const RATINGS = [
  { rating: 1, label: "Znowu",  color: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/25" },
  { rating: 2, label: "Trudne", color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/25" },
  { rating: 3, label: "Dobrze", color: "bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/25" },
  { rating: 4, label: "Łatwo",  color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/25" },
];

// ─── TYPES ─────────────────────────────────────────────────────────────────────
interface ReviewSession {
  deckId: string;
  deckTitle: string;
  cards: Flashcard[];
  currentIndex: number;
  flipped: boolean;
  done: boolean;
}

interface DeckFormState {
  title: string;
  emoji: string;
  color: string;
}

interface CardFormState {
  front: string;
  back: string;
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeckWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [deckModal, setDeckModal] = useState<{ open: boolean; editing?: FlashcardDeckWithStats }>({ open: false });
  const [cardModal, setCardModal] = useState<{ open: boolean; deckId?: string; deckTitle?: string }>({ open: false });
  const [generateModal, setGenerateModal] = useState<{ open: boolean; deck?: FlashcardDeckWithStats }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; deck?: FlashcardDeckWithStats }>({ open: false });

  // Review overlay
  const [review, setReview] = useState<ReviewSession | null>(null);

  // Form state
  const [deckForm, setDeckForm] = useState<DeckFormState>({ title: "", emoji: "📚", color: "#7c5cff" });
  const [cardForm, setCardForm] = useState<CardFormState>({ front: "", back: "" });
  const [generateTopics, setGenerateTopics] = useState("");
  const [generateCount, setGenerateCount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchDecks = useCallback(async () => {
    const res = await fetch("/api/flashcards");
    if (res.ok) setDecks(await res.json() as FlashcardDeckWithStats[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
  const totalCards = decks.reduce((s, d) => s + d._count.cards, 0);

  // ── Start review for a single deck ──
  async function startReview(deck: FlashcardDeckWithStats) {
    const res = await fetch(`/api/flashcards/${deck.id}/review`);
    if (!res.ok) return;
    const cards = await res.json() as Flashcard[];
    if (cards.length === 0) return;
    setReview({ deckId: deck.id, deckTitle: deck.title, cards, currentIndex: 0, flipped: false, done: false });
  }

  // ── Start review across ALL due decks ──
  async function startAllReview() {
    const dueDecks = decks.filter((d) => d.dueCount > 0);
    const allCards: Flashcard[] = [];
    for (const d of dueDecks) {
      const res = await fetch(`/api/flashcards/${d.id}/review`);
      if (res.ok) allCards.push(...(await res.json() as Flashcard[]));
    }
    if (allCards.length === 0) return;
    setReview({ deckId: "all", deckTitle: "Wszystkie talie", cards: allCards, currentIndex: 0, flipped: false, done: false });
  }

  // ── Submit rating in review ──
  async function submitRating(rating: number) {
    if (!review) return;
    const card = review.cards[review.currentIndex];
    // Each card has its own deckId — use it directly for the API call
    const deckId = card.deckId;

    await fetch(`/api/flashcards/${deckId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, rating }),
    });

    const nextIndex = review.currentIndex + 1;
    if (nextIndex >= review.cards.length) {
      setReview((r) => r ? { ...r, done: true } : null);
      fetchDecks();
    } else {
      setReview((r) => r ? { ...r, currentIndex: nextIndex, flipped: false } : null);
    }
  }

  // ── Deck CRUD ──
  async function saveDeck() {
    if (!deckForm.title.trim()) return;
    setSaving(true);
    try {
      const editing = deckModal.editing;
      const res = editing
        ? await fetch(`/api/flashcards/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deckForm),
          })
        : await fetch("/api/flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deckForm),
          });
      if (res.ok) { setDeckModal({ open: false }); fetchDecks(); }
    } finally {
      setSaving(false);
    }
  }

  async function deleteDeck() {
    if (!deleteConfirm.deck) return;
    await fetch(`/api/flashcards/${deleteConfirm.deck.id}`, { method: "DELETE" });
    setDeleteConfirm({ open: false });
    fetchDecks();
  }

  // ── Card creation ──
  async function saveCard() {
    if (!cardForm.front.trim() || !cardForm.back.trim() || !cardModal.deckId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/${cardModal.deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardForm),
      });
      if (res.ok) {
        setCardForm({ front: "", back: "" });
        setCardModal({ open: false });
        fetchDecks();
      }
    } finally {
      setSaving(false);
    }
  }

  // ── AI generation ──
  async function generateCards() {
    if (!generateModal.deck || !generateTopics.trim()) return;
    setGenerating(true);
    try {
      const topics = generateTopics.split("\n").map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: generateModal.deck.id, topics, count: generateCount }),
      });
      if (res.ok) {
        setGenerateModal({ open: false });
        setGenerateTopics("");
        fetchDecks();
        toast.success("Fiszki wygenerowane");
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Nie udało się wygenerować fiszek");
      }
    } catch {
      toast.error("Błąd połączenia z AI");
    } finally {
      setGenerating(false);
    }
  }

  // ── Helpers ──
  function openDeckModal(deck?: FlashcardDeckWithStats) {
    setDeckForm(deck ? { title: deck.title, emoji: deck.emoji, color: deck.color } : { title: "", emoji: "📚", color: "#7c5cff" });
    setDeckModal({ open: true, editing: deck });
  }

  // ─── REVIEW OVERLAY ──────────────────────────────────────────────────────────
  if (review) {
    const card = review.cards[review.currentIndex];
    const progress = ((review.currentIndex) / review.cards.length) * 100;

    if (review.done) {
      return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold">Sesja ukończona!</h2>
          <p className="text-muted-foreground">
            Powtórzyłeś {review.cards.length} {review.cards.length === 1 ? "kartę" : "kart"}.
            <br />Dobra robota!
          </p>
          <Button onClick={() => setReview(null)} size="lg">Wróć do talii</Button>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setReview(null)} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Zakończ
          </Button>
          <span className="text-sm text-muted-foreground font-medium">
            {review.currentIndex + 1} / {review.cards.length}
          </span>
          <div className="w-16" /> {/* spacer */}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
          <div
            className={cn(
              "w-full rounded-2xl border border-border bg-card shadow-sm cursor-pointer select-none transition-all duration-200",
              "active:scale-[0.99]",
              "min-h-[200px] flex flex-col items-center justify-center p-8 text-center gap-4"
            )}
            onClick={() => !review.flipped && setReview((r) => r ? { ...r, flipped: true } : null)}
          >
            {!review.flipped ? (
              <>
                <p className="text-lg font-semibold leading-relaxed">{card.front}</p>
                <p className="text-xs text-muted-foreground mt-2">Dotknij żeby zobaczyć odpowiedź</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide mb-2">Odpowiedź</p>
                <p className="text-base leading-relaxed">{card.back}</p>
              </>
            )}
          </div>

          {/* Rating buttons — only after flip */}
          {review.flipped && (
            <div className="grid grid-cols-2 gap-3 mt-6 w-full">
              {RATINGS.map(({ rating, label, color }) => {
                const days = rating === 1 ? 0 : rating === 2 ? 1 : rating === 3
                  ? Math.max(1, Math.round(card.stability * 9))
                  : Math.max(1, Math.round(card.stability * 18));
                return (
                  <Button
                    key={rating}
                    variant="outline"
                    className={cn("flex flex-col h-auto py-3 gap-0.5", color)}
                    onClick={() => submitRating(rating)}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs opacity-70">
                      {days === 0 ? "za chwilę" : formatNextInterval(days)}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MAIN UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <TopNavbar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-primary" />
              Fiszki
            </h1>
            {totalCards > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">{totalCards} kart · {decks.length} {decks.length === 1 ? "talia" : "talii"}</p>
            )}
          </div>
          <Button onClick={() => openDeckModal()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nowa talia
          </Button>
        </div>

        {/* Global CTA — review all due */}
        {totalDue > 0 && (
          <button
            onClick={startAllReview}
            className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-4 flex items-center justify-between mb-6 shadow-md hover:bg-primary/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔁</span>
              <div className="text-left">
                <p className="font-semibold">Powtarzaj teraz</p>
                <p className="text-sm opacity-80">{totalDue} {totalDue === 1 ? "karta czeka" : "kart czeka"}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 opacity-70" />
          </button>
        )}

        {/* Deck list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : decks.length === 0 ? (
          <EmptyState onNew={() => openDeckModal()} />
        ) : (
          <div className="space-y-3">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onReview={() => startReview(deck)}
                onEdit={() => openDeckModal(deck)}
                onDelete={() => setDeleteConfirm({ open: true, deck })}
                onAddCard={() => setCardModal({ open: true, deckId: deck.id, deckTitle: deck.title })}
                onGenerate={() => setGenerateModal({ open: true, deck })}
              />
            ))}
          </div>
        )}
      </main>
      <BottomNav />

      {/* ── New / Edit Deck Modal ── */}
      <Dialog open={deckModal.open} onOpenChange={(o) => setDeckModal((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{deckModal.editing ? "Edytuj talię" : "Nowa talia"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nazwa</label>
              <Input
                placeholder="np. Matematyka, Angielski…"
                value={deckForm.title}
                onChange={(e) => setDeckForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && saveDeck()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Emoji</label>
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setDeckForm((f) => ({ ...f, emoji: em }))}
                    className={cn(
                      "text-xl h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                      deckForm.emoji === em ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/70"
                    )}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Kolor</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDeckForm((f) => ({ ...f, color: c }))}
                    className={cn(
                      "h-8 w-8 rounded-full transition-transform",
                      deckForm.color === c && "ring-2 ring-offset-2 ring-foreground scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeckModal({ open: false })}>Anuluj</Button>
              <Button className="flex-1" onClick={saveDeck} disabled={saving || !deckForm.title.trim()}>
                {saving ? "Zapisuję…" : deckModal.editing ? "Zapisz" : "Utwórz"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Card Modal ── */}
      <Dialog open={cardModal.open} onOpenChange={(o) => setCardModal((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Dodaj kartę{cardModal.deckTitle ? ` — ${cardModal.deckTitle}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Pytanie (przód)</label>
              <Textarea
                placeholder="Wpisz pytanie…"
                value={cardForm.front}
                onChange={(e) => setCardForm((f) => ({ ...f, front: e.target.value }))}
                rows={3}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Odpowiedź (tył)</label>
              <Textarea
                placeholder="Wpisz odpowiedź…"
                value={cardForm.back}
                onChange={(e) => setCardForm((f) => ({ ...f, back: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCardModal({ open: false })}>Anuluj</Button>
              <Button className="flex-1" onClick={saveCard} disabled={saving || !cardForm.front.trim() || !cardForm.back.trim()}>
                {saving ? "Dodaję…" : "Dodaj kartę"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Generate Modal ── */}
      <Dialog open={generateModal.open} onOpenChange={(o) => setGenerateModal((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generuj fiszki AI
              {generateModal.deck && <span className="text-muted-foreground font-normal">— {generateModal.deck.title}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tematy (jeden na linię)</label>
              <Textarea
                placeholder={"np.\nCałkowanie przez podstawienie\nTwierdzenie Pitagorasa\nPochodne trygonometryczne"}
                value={generateTopics}
                onChange={(e) => setGenerateTopics(e.target.value)}
                rows={5}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Liczba fiszek: <strong>{generateCount}</strong></label>
              <input
                type="range"
                min={3}
                max={30}
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>3</span><span>30</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setGenerateModal({ open: false })} disabled={generating}>Anuluj</Button>
              <Button className="flex-1" onClick={generateCards} disabled={generating || !generateTopics.trim()}>
                {generating ? "Generuję…" : "Generuj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(o) => setDeleteConfirm((s) => ({ ...s, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń talię?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteConfirm.deck?.title}" oraz wszystkie karty zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDeck} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── DECK CARD COMPONENT ───────────────────────────────────────────────────────
function DeckCard({
  deck,
  onReview,
  onEdit,
  onDelete,
  onAddCard,
  onGenerate,
}: {
  deck: FlashcardDeckWithStats;
  onReview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddCard: () => void;
  onGenerate: () => void;
}) {
  const hasCards = deck._count.cards > 0;

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Emoji + color accent */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: `${deck.color}20` }}
          >
            {deck.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground truncate">{deck.title}</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />Edytuj talię
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddCard}>
                    <Plus className="h-4 w-4 mr-2" />Dodaj kartę
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onGenerate}>
                    <Sparkles className="h-4 w-4 mr-2" />Generuj AI
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Usuń talię
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {deck.newCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  {deck.newCount} nowych
                </span>
              )}
              {deck.dueCount > 0 && (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  {deck.dueCount} do powtórki
                </span>
              )}
              {deck._count.cards > 0 && deck.dueCount === 0 && deck.newCount === 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium">✓ wszystko powtórzone</span>
              )}
              {!hasCards && <span>Brak kart — dodaj pierwszą!</span>}
            </div>
          </div>
        </div>

        {/* Review button */}
        {deck.dueCount > 0 && (
          <Button
            onClick={onReview}
            className="w-full mt-3"
            style={{ backgroundColor: deck.color, color: "#fff" }}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Powtarzaj ({deck.dueCount})
          </Button>
        )}

        {!hasCards && (
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={onAddCard}>
              <Plus className="h-3.5 w-3.5 mr-1" />Dodaj ręcznie
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onGenerate}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />Generuj AI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMPTY STATE ───────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="text-5xl">📚</div>
      <div>
        <h2 className="text-lg font-semibold mb-1">Brak talii fiszek</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Stwórz talię i zacznij naukę metodą powtórzeń — najskuteczniejszą techniką zapamiętywania.
        </p>
      </div>
      <Button onClick={onNew} size="lg">
        <Plus className="h-4 w-4 mr-2" />
        Utwórz pierwszą talię
      </Button>
    </div>
  );
}
