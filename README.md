# Brain Dump

> Wyrzuć myśli z głowy. Zacznij działać.

Brain Dump to aplikacja webowa/PWA do zarządzania zadaniami, nauką i powtórkami. Łączy klasyczne task management, planowanie egzaminów, kalendarz, fiszki FSRS oraz opcjonalne funkcje AI.

---

## Funkcje

### Zadania i planowanie

- **Dashboard** — TOP 3 zadania, dzisiejsze sesje nauki i licznik fiszek do powtórki.
- **Dziś** — widok zadań i sesji tylko na aktualny dzień.
- **Zadania** — CRUD, kategorie, priorytety, podzadania, terminy, szacowany czas i operacje zbiorcze.
- **Smart Capture** — wklej tekst, a AI wyciągnie z niego zadania.
- **AI ad-hoc** — opis zadania jednym zdaniem może uzupełnić formularz.
- **AI priorytetyzacja** — automatyczna aktualizacja priorytetów aktywnych zadań.
- **Google Calendar sync** — tworzenie i usuwanie wydarzeń w głównym kalendarzu Google.

### Nauka

- **Egzaminy** — lista egzaminów i automatyczne generowanie sesji nauki.
- **Plan nauki** — sesje rozkładane w czasie, zgodnie z distributed practice.
- **Quiz AI** — generowanie pytań przed/po sesji nauki.
- **Refleksje po sesji** — ocena odpowiedzi/refleksji przez AI, jeśli dostępny jest klucz Anthropic.
- **Pomodoro** — timer do pracy w blokach.

### Fiszki

- **Talie fiszek** — tworzenie, edycja i usuwanie talii.
- **Karty** — ręczne dodawanie fiszek oraz generowanie fiszek przez AI.
- **Powtórki FSRS** — planowanie kolejnych powtórek na podstawie ocen: Again, Hard, Good, Easy.
- **Statystyki fiszek** — liczba due cards i metryki w widoku statystyk.

### Kalendarz

- **Tydzień** — widok kolumnowy z drag & drop między dniami.
- **Miesiąc** — siatka miesiąca z kompaktowymi zadaniami i sesjami.
- **Bloki** — dzienny planner od 8:00 do 22:00 w krokach co 30 minut.

### Analityka, PWA i ustawienia

- **Statystyki** — wykresy produktywności, rozkład pracy i dane o fiszkach.
- **Przegląd tygodnia AI** — analiza postępów i sugestie korekt.
- **Share Target** — udostępnianie tekstu/URL do Brain Dump i analiza AI.
- **PWA** — manifest, service worker, cache i strona offline.
- **Push** — subskrypcja, test push i cron-y przypominające o zadaniach/nauce.
- **Eksport/import** — JSON dump danych użytkownika i import.

---

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 App Router |
| Język | TypeScript |
| UI | Tailwind CSS + shadcn/ui + Radix |
| Baza danych | PostgreSQL + Prisma ORM 7 |
| Auth | NextAuth.js v4, Google OAuth, credentials |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Kalendarz | Google Calendar API |
| PWA | `@ducanh2912/next-pwa` |
| Push | Web Push API + VAPID |
| Email | Nodemailer SMTP |
| Hosting | Vercel + Supabase |

---

## Uruchomienie lokalne

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

Do szybkiego sprawdzenia jakości:

```bash
npx tsc --noEmit
npm run lint
```

`npm run build` wymaga kompletu zmiennych środowiskowych używanych przez route'y budowane po stronie serwera. W szczególności cron-y push wymagają VAPID.

---

## Zmienne środowiskowe

Minimalne lokalne uruchomienie wymaga bazy danych i auth. AI, Google Calendar, push i email są opcjonalne, ale powiązane funkcje zwrócą czytelny błąd, jeśli brakuje konfiguracji.

```env
# Baza danych
DATABASE_URL="postgresql://user:password@localhost:5432/taskapp"
DIRECT_URL="postgresql://user:password@localhost:5432/taskapp"

# Auth
NEXTAUTH_SECRET="losowy-string-minimum-32-znaki"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth + Google Calendar
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Push / VAPID
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@example.com"

# Cron security, jeśli używany w deployu
CRON_SECRET="losowy-string"

# Email SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="twoj@gmail.com"
SMTP_PASS="haslo-aplikacji"
```

Uwagi:

- `DATABASE_URL` jest używane w runtime.
- `DIRECT_URL` jest przydatne dla Prisma CLI i migracji, szczególnie na Supabase.
- Google OAuth musi mieć redirect URI: `http://localhost:3000/api/auth/callback/google`.
- Google Calendar wymaga włączonego API i zakresu `https://www.googleapis.com/auth/calendar.events`.

---

## Struktura projektu

```text
app/
├── dashboard/          # TOP 3, sesje na dziś, fiszki do powtórki
├── today/              # dzisiejsze zadania i sesje
├── tasks/              # lista zadań, bulk actions, AI priorytetyzacja
├── exams/              # egzaminy, sesje nauki, quizy
├── flashcards/         # talie, karty, FSRS review, AI generowanie
├── calendar/           # tydzień, miesiąc, bloki 30-minutowe
├── braindump/          # Smart Capture
├── share/              # PWA Share Target
├── stats/              # statystyki i wykresy
├── review/             # tygodniowy przegląd AI
├── settings/           # konto, push, import/export
└── api/
    ├── tasks/
    ├── exams/
    ├── flashcards/
    ├── categories/
    ├── calendar/sync/
    ├── push/
    ├── stats/
    ├── import/
    ├── export/
    ├── cron/
    │   ├── reminders/
    │   ├── weekly-review-nudge/
    │   └── sleep-consolidation/
    └── ai/
        ├── batch-parse/
        ├── daily-brief/
        ├── extract-tasks/
        ├── focus-recommendation/
        ├── generate-flashcards/
        ├── generate-quiz/
        ├── parse-task/
        ├── prioritize/
        └── weekly-review/

components/
├── task-card.tsx
├── task-modal.tsx
├── exam-card.tsx
├── quiz-modal.tsx
├── pomodoro-timer.tsx
├── command-palette.tsx
├── push-subscribe.tsx
└── ui/

lib/
├── auth.ts
├── claude.ts
├── fsrs.ts
├── google-calendar.ts
├── mailer.ts
├── prisma.ts
├── push.ts
├── study-planner.ts
└── utils.ts
```

---

## Crony

`vercel.json` definiuje:

| Ścieżka | Harmonogram | Cel |
|---|---:|---|
| `/api/cron/reminders` | `0 8 * * *` | przypomnienia o deadline'ach |
| `/api/cron/habit-reminders` | `0 19 * * *` | wpis historyczny w configu; route obecnie nie istnieje |
| `/api/cron/weekly-review-nudge` | `0 18 * * 0` | zachęta do przeglądu tygodnia |
| `/api/cron/sleep-consolidation` | `30 21 * * *` | wieczorna konsolidacja materiału |

Przed deployem warto usunąć albo przywrócić `/api/cron/habit-reminders`, żeby konfiguracja Vercel nie wskazywała nieistniejącego endpointu.

---

## CI

GitHub Actions uruchamia workflow `Type-check & Lint` dla PR-ów do `main`, pushy do `main`, branchy `dependabot/**` i ręcznego `workflow_dispatch`.

Pipeline:

```text
npm install -> npx prisma generate -> npx tsc --noEmit -> npm run lint
```

---

## Status / uwagi deweloperskie

- UI jest po polsku.
- API routes sprawdzają sesję przez NextAuth.
- Brak `ANTHROPIC_API_KEY` powinien skutkować kontrolowanym błędem `503` w endpointach AI.
- Kalendarz używa drag & drop z krokiem 30 minut w widoku blokowym.
- `npm run lint` i `npx tsc --noEmit` przechodzą bez błędów.
