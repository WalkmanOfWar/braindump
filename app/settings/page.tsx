"use client";

import { useState, useRef, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Download, Upload, Trash2, User, Bell, Palette, LogOut, Loader2, Sun, Moon, Link2, Copy, Check, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { PushSubscribeButton } from "@/components/push-subscribe";
import { cn } from "@/lib/utils";

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareToken, setShareToken] = useState<string | null | undefined>(undefined);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Reminder preferences
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderHours, setReminderHours] = useState(24);
  const [reminderFetched, setReminderFetched] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);

  useEffect(() => {
    fetch("/api/account/preferences")
      .then((r) => r.json())
      .then((data: { reminderEnabled: boolean; reminderHoursBefore: number }) => {
        setReminderEnabled(data.reminderEnabled);
        setReminderHours(data.reminderHoursBefore);
      })
      .catch(() => {})
      .finally(() => setReminderFetched(true));
  }, []);

  const saveReminderPrefs = async (enabled: boolean, hours: number) => {
    setReminderSaving(true);
    try {
      await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderEnabled: enabled, reminderHoursBefore: hours }),
      });
      toast.success("Zapisano ustawienia powiadomień");
    } catch {
      toast.error("Nie udało się zapisać");
    } finally {
      setReminderSaving(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        const { imported } = data as { imported: { tasks: number; categories: number } };
        toast.success(
          `Zaimportowano: ${imported.tasks} zadań, ${imported.categories} kategorii`
        );
      } else {
        toast.error(data.error ?? "Błąd importu");
      }
    } catch {
      toast.error("Nieprawidłowy plik JSON");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLoadShareToken = async () => {
    if (shareToken !== undefined) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/share");
      const data = await res.json() as { shareToken: string | null };
      setShareToken(data.shareToken);
    } catch {
      toast.error("Nie udało się załadować linku");
    } finally {
      setShareLoading(false);
    }
  };

  const handleGenerateShareLink = async () => {
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json() as { shareToken: string };
      setShareToken(data.shareToken);
    } catch {
      toast.error("Nie udało się wygenerować linku");
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShareLink = async () => {
    setShareLoading(true);
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      setShareToken(null);
      toast.success("Link dezaktywowany");
    } catch {
      toast.error("Nie udało się dezaktywować linku");
    } finally {
      setShareLoading(false);
    }
  };

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}`
    : null;

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      toast.success("Konto usunięte");
      await signOut({ callbackUrl: "/login" });
    } else {
      toast.error("Nie udało się usunąć konta");
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <TopNavbar />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground mb-6">Ustawienia</h1>

        {/* Profile */}
        <Section icon={User} title="Profil" description="Zarządzane przez Google">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={session?.user?.image ?? undefined} alt={session?.user?.name ?? "Avatar"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{session?.user?.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground truncate">{session?.user?.email ?? "—"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })} className="gap-1.5">
              <LogOut className="w-4 h-4" />
              Wyloguj
            </Button>
          </div>
        </Section>

        {/* Theme */}
        <Section icon={Palette} title="Motyw" description="Wybierz wygląd interfejsu">
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((mode) => {
              const Icon = mode === "light" ? Sun : Moon;
              return (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-colors",
                    resolvedTheme === mode
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {mode === "light" ? "Jasny" : "Ciemny"}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Powiadomienia" description="Push w przeglądarce + email przy zbliżających się terminach">
          <div className="space-y-4">
            {/* Push */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Powiadomienia push</p>
                <p className="text-xs text-muted-foreground">Wymagana zgoda przeglądarki</p>
              </div>
              <PushSubscribeButton />
            </div>

            {/* Email reminders toggle */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">Przypomnienia email</p>
                <p className="text-xs text-muted-foreground">
                  {session?.user?.email ?? "Twój adres e-mail"}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!reminderFetched) return;
                  const next = !reminderEnabled;
                  setReminderEnabled(next);
                  saveReminderPrefs(next, reminderHours);
                }}
                disabled={!reminderFetched || reminderSaving}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  reminderEnabled ? "bg-primary" : "bg-muted-foreground/30"
                )}
                role="switch"
                aria-checked={reminderEnabled}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    reminderEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Hours before deadline */}
            {reminderEnabled && reminderFetched && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Na ile przed terminem?
                </p>
                <div className="flex gap-1.5">
                  {([1, 2, 6, 24, 48] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        setReminderHours(h);
                        saveReminderPrefs(reminderEnabled, h);
                      }}
                      disabled={reminderSaving}
                      className={cn(
                        "flex-1 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50",
                        reminderHours === h
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {h < 24 ? `${h}h` : h === 24 ? "24h" : "2 dni"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Tygodniowy przegląd wysyłany w niedzielę o 18:00
            </p>
          </div>
        </Section>

        {/* Data */}
        <Section icon={Download} title="Dane" description="Eksportuj lub importuj swoje dane">
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <a href="/api/export" download>
                <Download className="w-4 h-4" />
                Eksportuj wszystko (JSON)
              </a>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importowanie…" : "Importuj z pliku JSON"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Import dodaje rekordy do istniejących — nie nadpisuje. Plik musi być w formacie eksportu Brain Dump.
            </p>
          </div>
        </Section>

        {/* Peer Accountability */}
        <Section
          icon={Link2}
          title="Publiczny link do statystyk"
          description="Ariely & Wertenbroch (2002) — publiczne zobowiązanie zwiększa dotrzymywanie terminów o ~31%"
        >
          <div className="space-y-3">
            {shareToken === undefined && !shareLoading && (
              <Button variant="outline" size="sm" onClick={handleLoadShareToken} className="w-full">
                Pokaż opcje udostępniania
              </Button>
            )}
            {shareLoading && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {shareToken === null && !shareLoading && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Brak aktywnego linku. Wygeneruj go i udostępnij znajomemu — widoczne będą tylko statystyki (bez danych osobowych).
                </p>
                <Button size="sm" onClick={handleGenerateShareLink} className="w-full gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Wygeneruj link
                </Button>
              </div>
            )}
            {shareToken && !shareLoading && shareUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{shareUrl}</span>
                  <button onClick={handleCopyShareUrl} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    {shareCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyShareUrl} className="flex-1 gap-1.5">
                    {shareCopied ? <><Check className="w-3.5 h-3.5 text-green-500" />Skopiowano!</> : <><Copy className="w-3.5 h-3.5" />Kopiuj link</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleGenerateShareLink} className="gap-1.5" title="Wygeneruj nowy token">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleRevokeShareLink} className="text-destructive hover:text-destructive">
                    Dezaktywuj
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Danger zone */}
        <Section icon={Trash2} title="Strefa niebezpieczna" description="Operacje nieodwracalne">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Usuń moje konto
          </Button>
        </Section>
      </main>

      <BottomNav />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć konto na zawsze?</AlertDialogTitle>
            <AlertDialogDescription>
              Wszystkie Twoje zadania, egzaminy, fiszki i notatki zostaną trwale usunięte.
              Tej akcji nie można cofnąć. Pamiętaj o wcześniejszym eksporcie danych jeśli chcesz je zachować.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Usuwanie…" : "Tak, usuń konto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
