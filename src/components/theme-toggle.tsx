"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes' documented SSR/hydration-mismatch guard: resolvedTheme is undefined on
  // the server, so this flips `mounted` exactly once after client mount to unblock
  // rendering the real button.
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
