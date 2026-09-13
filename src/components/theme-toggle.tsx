"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // SSR/hydration-mismatch guard: the persisted theme only exists on the client,
  // so this flips `mounted` exactly once after mount to unblock rendering the button.
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect

  if (!mounted) {
    return <span className="size-8 border border-border" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className="flex size-8 items-center justify-center border border-border text-foreground hover:bg-muted"
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}
