"use client";

import { useState, useRef } from "react";
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
import { Download, Upload, Trash2, User, Bell, Palette, LogOut, Loader2, Sun, Moon } from "lucide-react";
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
        const { imported } = data as { imported: { tasks: number; categories: number; goals: number; habits: number } };
        toast.success(
          `Zaimportowano: ${imported.tasks} zadań, ${imported.categories} kategorii, ${imported.goals} celów, ${imported.habits} nawyków`
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Powiadomienia push</p>
                <p className="text-xs text-muted-foreground">Wymagana zgoda przeglądarki</p>
              </div>
              <PushSubscribeButton />
            </div>
            <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
              <p>• 08:00 — przypomnienia o terminach</p>
              <p>• 21:00 — nieodhaczone nawyki</p>
              <p>• Niedziela 20:00 — tygodniowy przegląd</p>
            </div>
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
              Wszystkie Twoje zadania, egzaminy, nawyki, cele i notatki zostaną trwale usunięte.
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
