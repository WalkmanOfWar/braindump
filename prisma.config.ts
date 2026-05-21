import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load .env.local for CLI commands (Next.js convention)
config({ path: ".env.local" });

// Prisma 7 config — adapter is passed at PrismaClient instantiation in lib/prisma.ts
// DIRECT_URL is used by CLI commands (db push, migrate) — bypasses PgBouncer pooler
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
