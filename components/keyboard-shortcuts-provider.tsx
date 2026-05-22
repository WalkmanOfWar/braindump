"use client";

import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts";

export function KeyboardShortcutsProvider() {
  useGlobalShortcuts();
  return null;
}
