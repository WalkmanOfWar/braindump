import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/auth.ts",
        "lib/claude.ts",
        "lib/google-calendar.ts",
        "lib/mailer.ts",
        "lib/prisma.ts",
        "lib/push.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
