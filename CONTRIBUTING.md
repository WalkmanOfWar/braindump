# Contributing to Brain Dump

Thanks for your interest! This is primarily a personal project, but contributions are welcome.

## Getting Started

```bash
git clone https://github.com/WalkmanOfWar/braindump.git
cd braindump
npm install
cp .env.local.example .env.local  # fill in your credentials
npx prisma db push
npm run dev
```

## Making Changes

1. **Fork** the repository and create a branch from `main`
2. **Code** — follow the existing style (TypeScript strict, Tailwind, Polish UI strings)
3. **Check** — run `npx tsc --noEmit` before pushing; zero errors required
4. **PR** — open a pull request with a clear description of what and why

## Guidelines

- All user-facing text must be in **Polish**
- No `any` types — define proper types in `types/index.ts`
- API routes must check session via `getServerSession(authOptions)`
- Keep components small and reusable under `components/ui/`

## Reporting Bugs

Open a [GitHub Issue](https://github.com/WalkmanOfWar/braindump/issues) with steps to reproduce, expected vs actual behaviour, and your browser/OS.
