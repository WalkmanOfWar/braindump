# Brain Dump

> Wyrzuć myśli z głowy. Zacznij działać.

Aplikacja webowa + mobilna (PWA) do zarządzania zadaniami i nauką, zaprojektowana zgodnie z dowodami naukowymi dotyczącymi efektywnego uczenia się i produktywności.

---

## Funkcje

### Zarządzanie zadaniami
- **Zadania** — CRUD z priorytetami, kategoriami, celami, podzadaniami, cyklicznością i szacowanym czasem
- **Smart Capture** — wklej dowolny tekst (e-mail, notatka, Slack), AI wyodrębnia zadania automatycznie
- **AI ad-hoc** — opisz zadanie jednym zdaniem, AI uzupełnia formularz
- **AI priorytetyzacja** — automatyczne ustawianie priorytetów na podstawie pilności i wagi
- **Bulk operacje** — wielozaznaczenie i masowe akcje na liście zadań
- **Google Calendar sync** — synchronizacja zadań z Google Calendar

### Nauka i egzaminy
- **Planer egzaminów** — generuje plan sesji nauki rozłożonych w czasie (Distributed Practice ✓)
- **Pomodoro Timer** — 25/5 min cykle z integracją z sesjami egzaminacyjnymi
- **Przegląd tygodnia** — AI analizuje postępy i sugeruje korekty planu

### Produktywność
- **Focus Mode** — tryb skupienia odcinający rozpraszacze
- **"Co teraz?" AI** — inteligentna sugestia następnego zadania
- **Cmd+K palette** — błyskawiczne dodawanie i nawigacja
- **Kalendarz** — widok tygodniowy i miesięczny z drag & drop
- **Dziś** — widok tylko dzisiejszych zadań i sesji

### Nawyki i cele
- **Tracker nawyków** — heatmapa, streak, częstotliwość (dziennie / N× w tygodniu / co N dni)
- **Cele długoterminowe** — emoji + kolor, powiązanie zadań z celami, pasek postępu
- **Powiadomienia push** — przypomnienia o nawykach codziennie o 21:00

### Analityka i eksport
- **Statystyki** — trend ukończeń, rozkład wg dnia tygodnia i godziny, najlepsza godzina pracy
- **Eksport danych** — pełny dump JSON wszystkich danych użytkownika

### PWA / mobilna
- **Share Target** — udostępnij artykuł lub URL prosto do Brain Dump, AI wyodrębni zadania
- **Offline** — Service Worker + cache
- **Instalacja** — działa jak natywna aplikacja na Androidzie i iOS

---

## Podstawy naukowe

Aplikacja jest budowana w oparciu o badania dotyczące efektywnej nauki. Poniżej obecny status i roadmapa:

### Zaimplementowane ✅

| Technika | Badanie | Implementacja |
|---|---|---|
| **Distributed Practice** | Cepeda et al. (2006) | Planer egzaminów rozkłada sesje w czasie |
| **Implementation Intentions** | Gollwitzer (1999) | Deadline + szacowany czas na każdym zadaniu |
| **Habit Stacking** | Fogg (2019) | Tracker nawyków z konfigurowalnymi cyklami |
| **Pomodoro / Time-boxing** | Cirillo; Ariga & Lleras (2011) | Timer Pomodoro 25/5 min |
| **Cognitive Load Reduction** | Sweller (1988) | TOP 3 na dashboardzie, Focus Mode |
| **Weekly Review** | Allen (2001) | Przegląd tygodnia z analizą AI |
| **Progress Visibility** | Bandura (1977) | Statystyki, streaki, paski postępu celów |

### Zaplanowane 🔜

| Technika | Badanie | Planowana funkcja |
|---|---|---|
| **Spaced Repetition (SRS)** | Ebbinghaus (1885); Cepeda et al. (2006) | Fiszki z algorytmem FSRS — najsilniejszy efekt na długoterminową retencję |
| **Retrieval Practice / Testing Effect** | Roediger & Karpicke (2006), *Science* | Quiz AI generowany z tematów sesji nauki |
| **Metacognitive Monitoring** | Flavell (1979); Dunning & Kruger (1999) | Ocena pewności (1–5) po każdej sesji, adaptująca kolejne |
| **Interleaving** | Kornell & Bjork (2008); Taylor & Rohrer (2010) | Tryb przeplatania tematów w planerze egzaminów |
| **Generation Effect** | Slamecka & Graf (1978) | Prompt „Wyjaśnij własnymi słowami" po sesji (Technika Feynmana) |
| **Pre-test Effect** | Kornell (2009) | „Co już wiesz?" przed rozpoczęciem sesji |
| **Sleep Consolidation** | Walker (2017); Stickgold (2005) | Wieczorne przypomnienie „Przejrzyj kluczowe punkty przed snem" |
| **Ultradian Rhythms** | Kleitman; Lavie (1982) | Deep Work Mode — 90-minutowe bloki zamiast 25 min |

> **Dlaczego SRS i Retrieval Practice są priorytetem?**
>
> Meta-analiza Dunlosky et al. (2013, *Psychological Science in the Public Interest*) oceniła 10 technik nauki pod kątem skuteczności. Tylko dwie otrzymały ocenę **"high utility"**: **Practice Testing** (Retrieval Practice) i **Distributed Practice**. Spaced Repetition łączy obie w jednym mechanizmie. Popularne techniki takie jak highlighting, rereading czy summarization otrzymały ocenę **"low utility"** pomimo powszechnego stosowania.

---

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Język | TypeScript |
| Style | Tailwind CSS + shadcn/ui |
| Baza danych | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v4 (Google OAuth) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Kalendarz | Google Calendar API |
| Push | Web Push API + VAPID |
| Email | Nodemailer (SMTP) |
| Cron | Vercel Cron Jobs |
| Hosting | Vercel + Supabase |

---

## Uruchomienie

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

### Zmienne środowiskowe

Skopiuj `.env.example` do `.env.local` i uzupełnij:

```env
# Baza danych — Supabase lub lokalne PostgreSQL
DATABASE_URL=postgresql://...        # pooled connection (runtime, Supabase port 6543)
DIRECT_URL=postgresql://...          # direct connection (Prisma CLI, Supabase port 5432)

# Auth
NEXTAUTH_SECRET=losowy-string-min-32-znaki
NEXTAUTH_URL=http://localhost:3000

# Google OAuth + Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# AI (wymagane dla Smart Capture, Priorytetyzacji, Przeglądu tygodnia)
ANTHROPIC_API_KEY=sk-ant-...

# Push Notifications (opcjonalne)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:twoj@email.com

# Cron Security (wymagane na Vercel)
CRON_SECRET=losowy-string

# Email (opcjonalne — przypomnienia o deadlinach)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=twoj@gmail.com
SMTP_PASS=haslo-aplikacji-gmail
```

---

## Struktura projektu

```
app/
├── dashboard/          ← TOP 3 zadania + sesje nauki na dziś
├── today/              ← widok tylko dzisiejszych zadań
├── tasks/              ← lista zadań, bulk operacje, AI priorytetyzacja
├── exams/              ← egzaminy + planer sesji nauki
├── calendar/           ← widok tygodniowy / miesięczny z drag & drop
├── habits/             ← tracker nawyków z heatmapą i częstotliwością
├── goals/              ← cele długoterminowe powiązane z zadaniami
├── stats/              ← statystyki i wykresy produktywności
├── review/             ← tygodniowy przegląd AI
├── braindump/          ← Smart Capture — AI wyodrębnia zadania z tekstu
├── share/              ← PWA Share Target
├── settings/           ← ustawienia konta i powiadomień
└── api/
    ├── tasks/          ← GET, POST, PATCH, DELETE
    ├── exams/          ← GET, POST + sessions toggle
    ├── categories/     ← GET, POST
    ├── habits/         ← GET, POST, PATCH, DELETE
    ├── goals/          ← GET, POST, PATCH, DELETE
    ├── stats/          ← GET — dane do wykresów
    ├── export/         ← GET — pełny eksport JSON
    ├── calendar/sync/  ← POST — Google Calendar
    ├── push/           ← subscribe, unsubscribe, test
    ├── cron/
    │   ├── reminders/           ← deadline reminders (8:00 UTC)
    │   └── habit-reminders/     ← habit nudge (19:00 UTC)
    └── ai/
        ├── prioritize/          ← AI priorytetyzacja zadań
        ├── extract-tasks/       ← Smart Capture
        ├── focus/               ← "Co teraz?" sugestia
        └── weekly-review/       ← przegląd tygodnia

components/
├── task-card.tsx        ← karta zadania (urgency, goal badge, subtask progress)
├── task-modal.tsx       ← modal dodawania/edycji z AI ad-hoc i goal picker
├── exam-card.tsx        ← karta egzaminu z planem sesji i Pomodoro
├── pomodoro-timer.tsx   ← globalny timer Pomodoro
├── command-palette.tsx  ← Cmd+K palette
├── push-subscribe.tsx   ← przycisk subskrypcji push z testem
└── ui/                  ← shadcn/ui components

lib/
├── prisma.ts            ← singleton PrismaClient
├── auth.ts              ← NextAuth options
├── study-planner.ts     ← generateSessions()
├── claude.ts            ← AI functions (prioritize, extract, focus, review)
├── google-calendar.ts   ← createCalendarEvent, deleteCalendarEvent
├── push.ts              ← sendPushToUser()
├── mailer.ts            ← sendDeadlineReminder()
└── utils.ts             ← cn(), formatDate, getDaysUntil, getUrgencyLevel, toUiTask
```

---

## CI / Jakość kodu

Każdy PR do `main` uruchamia automatyczny pipeline na GitHub Actions:

```
npm install → prisma generate → tsc --noEmit → eslint
```

`main` jest chroniony — bezpośrednie pushe są zablokowane. Merge wymaga przejścia CI.
