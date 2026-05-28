"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

// Writes the resolved theme to a long-lived cookie so the server can read it on
// the next request and pass it as `defaultTheme` — eliminating SSR flash.
function ThemePersist() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") {
      document.cookie = `theme=${resolvedTheme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    }
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
    >
      <ThemePersist />
      {children}
    </NextThemesProvider>
  );
}
