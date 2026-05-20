# Brain Dump

Aplikacja webowa (PWA) do zarządzania zadaniami i sesjami nauki. Pomaga ogarnąć dużo zadań naraz, nie zapominać o deadlinach i planować naukę przed egzaminami.

## Funkcje

- **Zadania** — dodawanie, edycja, filtrowanie, priorytety, kategorie, tagi
- **AI ad-hoc** — wpisz zadanie jednym zdaniem po polsku, AI uzupełni resztę formularza
- **AI priorytetyzacja** — automatyczne ustawianie priorytetów na liście zadań
- **Egzaminy** — generowanie planu sesji nauki na podstawie daty egzaminu
- **Kalendarz** — widok tygodniowy zadań i sesji nauki
- **Google Calendar sync** — synchronizacja zadań z Google Calendar
- **Logowanie** — Google OAuth, GitHub, Facebook, email+hasło

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Język | TypeScript |
| Style | Tailwind CSS + shadcn/ui |
| Baza danych | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v4 |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Kalendarz | Google Calendar API |
| Email | Nodemailer |
| Hosting | Vercel + Supabase |

## Uruchomienie

```bash
npm install
```

Uzupełnij `.env.local`:

```env
DATABASE_URL=postgresql://...      # pooled connection (runtime)
DIRECT_URL=postgresql://...        # direct connection (Prisma CLI / migracje)
NEXTAUTH_SECRET=losowy-string-min-32-znaki
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...              # opcjonalne — AI
SMTP_HOST=...                      # opcjonalne — email
```

> **Supabase:** `DATABASE_URL` to adres przez Transaction Pooler (port 6543), `DIRECT_URL` to adres bezpośredni (port 5432). Oba znajdziesz w panelu Supabase → Settings → Database.

```bash
npx prisma db push
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

## Struktura projektu

```
app/
├── dashboard/        ← TOP 3 zadania + sesje nauki na dziś
├── tasks/            ← lista zadań z filtrowaniem + AI
├── exams/            ← egzaminy + plan nauki
├── calendar/         ← widok tygodniowy
└── api/              ← REST API (tasks, exams, categories, ai, calendar)

components/           ← task-modal, exam-modal, task-card, nawigacja
lib/                  ← prisma, auth, claude, study-planner, google-calendar
prisma/schema.prisma  ← schemat bazy danych
```
