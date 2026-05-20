import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 config — adapter is passed at PrismaClient instantiation in lib/prisma.ts
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
});
