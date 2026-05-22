import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegistration } from "@/components/sw-register";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { CommandPalette } from "@/components/command-palette";
import { PomodoroProvider } from "@/components/pomodoro-timer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Brain Dump - Wyrzuć myśli z głowy",
  description:
    "Aplikacja do zarządzania zadaniami i nauką. Wyrzuć myśli z głowy i zacznij działać.",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Brain Dump",
  },
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c5cff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="font-sans antialiased bg-background">
        <ThemeProvider>
          <SessionProvider>
            <PomodoroProvider>
              {children}
              <Toaster richColors position="bottom-right" />
              <ServiceWorkerRegistration />
              <KeyboardShortcutsProvider />
              <CommandPalette />
            </PomodoroProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
