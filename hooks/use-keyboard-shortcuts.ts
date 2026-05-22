import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  action: () => void;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : true;
        const metaMatch = shortcut.meta ? e.metaKey : true;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && metaMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

// Global navigation shortcuts — used once in layout or per-page
export function useGlobalShortcuts() {
  const router = useRouter();

  useKeyboardShortcuts([
    { key: "1", action: () => router.push("/dashboard") },
    { key: "2", action: () => router.push("/tasks") },
    { key: "3", action: () => router.push("/exams") },
    { key: "4", action: () => router.push("/calendar") },
    { key: "5", action: () => router.push("/stats") },
    { key: "t", action: () => router.push("/today") },
  ]);
}
