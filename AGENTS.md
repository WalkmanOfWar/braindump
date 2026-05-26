# AGENTS.md — TaskApp (Brain Dump)

Jesteś doświadczonym full-stack developerem budującym aplikację do zarządzania zadaniami po polsku.
Pracuj krok po kroku, zawsze uruchamiaj komendy samodzielnie, pytaj tylko gdy coś jest krytycznie niejasne.

---

## Cel projektu

Aplikacja webowa + mobilna (PWA) dla osób mających dużo zadań.
Główne problemy które rozwiązuje:
- Za dużo na głowie, nie wiadomo od czego zacząć
- Zapominanie o deadlinach
- Brak planu nauki przed egzaminami

---

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Język | TypeScript |
| Style | Tailwind CSS + shadcn/ui |
| Baza danych | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v4 (Google OAuth) |
| Kalendarz | Google Calendar API (googleapis) |
| AI (opcjonalne) | Anthropic Codex API (`Codex-sonnet-4-6`) |
| Email | Nodemailer (SMTP) |
| Hosting | Vercel + Supabase |

---

## Struktura plików

```
app/
├── layout.tsx                  ← SessionProvider wraps all
├── page.tsx                    ← redirect → /login
├── login/page.tsx              ← Google OAuth login
├── dashboard/page.tsx          ← TOP 3 zadania + sesje nauki na dziś
├── tasks/page.tsx              ← lista zadań z filtrowaniem + AI priorytetyzacja
├── exams/page.tsx              ← lista egzaminów + generowanie planu nauki
├── calendar/page.tsx           ← widok tygodniowy
└── api/
    ├── auth/[...nextauth]/route.ts
    ├── tasks/route.ts              ← GET, POST
    ├── tasks/[id]/route.ts         ← GET, PATCH, DELETE
    ├── exams/route.ts              ← GET, POST
    ├── exams/[id]/route.ts         ← GET, DELETE
    ├── exams/[id]/sessions/route.ts ← PATCH (toggle done)
    ├── categories/route.ts         ← GET, POST
    ├── calendar/sync/route.ts      ← POST (create/delete Google Calendar event)
    └── ai/prioritize/route.ts      ← POST (Codex AI priorytetyzacja)

components/
├── session-provider.tsx        ← NextAuth SessionProvider (client)
├── top-navbar.tsx
├── bottom-nav.tsx
├── task-card.tsx               ← przyjmuje `categoryOverride` prop
├── task-modal.tsx              ← przyjmuje `categories` prop
├── exam-card.tsx               ← używa ExamWithSessions (Prisma types)
├── exam-modal.tsx              ← wywołuje POST /api/exams bezpośrednio
└── ui/                         ← shadcn/ui components

lib/
├── prisma.ts                   ← singleton PrismaClient
├── auth.ts                     ← NextAuth options (Google OAuth + PrismaAdapter)
├── study-planner.ts            ← generateSessions()
├── google-calendar.ts          ← createCalendarEvent, deleteCalendarEvent
├── Codex.ts                   ← prioritizeTasks() via Anthropic SDK
├── mailer.ts                   ← sendDeadlineReminder() via nodemailer
├── mock-data.ts                ← TYLKO jako fallback dla UI typów (Task, Category)
└── utils.ts                    ← cn()

types/index.ts                  ← TaskWithCategory, ExamWithSessions, input types
proxy.ts                        ← chroni /dashboard, /tasks, /exams, /calendar (Next.js 16)
prisma/schema.prisma
```

---

## Uruchomienie

```bash
# 1. Zainstaluj zależności
npm install

# 2. Uzupełnij .env.local (DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET)

# 3. Zsynchronizuj bazę danych
npx prisma db push

# 4. Uruchom dev server
npm run dev
```

---

## Kolejność implementacji (status)

- [x] Setup — zależności, schema, lib/, middleware
- [x] Auth — NextAuth Google OAuth, strona /login
- [x] Zadania — CRUD API + strona z filtrowaniem
- [x] Kategorie — CRUD API, dropdown w modalach
- [x] Kalendarz — widok tygodniowy z zadaniami i sesjami
- [x] Egzaminy — CRUD + generowanie planu nauki
- [x] Google Calendar sync — POST /api/calendar/sync
- [x] AI priorytetyzacja — przycisk "AI" na liście zadań
- [ ] Powiadomienia email — cron job / webhook 24h przed deadlinem
- [ ] PWA manifest + service worker

---

## Zasady kodowania

- Wszystkie teksty w interfejsie po **polsku**
- Używaj **Server Components** wszędzie gdzie nie potrzebujesz stanu
- Pobieranie danych przez **API routes** (`/api/...`), nie bezpośrednio z bazy w komponentach
- Każde API route sprawdza sesję przez `getServerSession(authOptions)`
- Obsługa błędów — zawsze zwracaj sensowny komunikat po polsku
- Typy — nie używaj `any`, definiuj typy w `types/index.ts`
- Komponenty UI trzymaj małe i reużywalne w `components/ui/`
- Model AI: `Codex-sonnet-4-6`

---

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection string (runtime, Supabase: port 6543) |
| `DIRECT_URL` | PostgreSQL direct connection string (Prisma CLI / migracje, Supabase: port 5432) |
| `NEXTAUTH_SECRET` | Losowy string ≥32 znaki |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) lub domena prod |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `ANTHROPIC_API_KEY` | Opcjonalne — AI priorytetyzacja |
| `SMTP_HOST/PORT/USER/PASS` | Opcjonalne — powiadomienia email |
