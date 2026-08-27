"use client";

import { useEffect, useLayoutEffect } from "react";
import { useTheme } from "next-themes";

// React warns if useLayoutEffect runs during SSR; since this component is rendered
// by a server component tree, fall back to useEffect there (a no-op on the server
// anyway) and use the real layout effect once we're on the client.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The authenticated app ((app)/* routes, AppHeader, simulation components) predates
 * dark mode and is full of hardcoded light-only colors (bg-white, bg-[#F5F5F5], ...)
 * mixed with token classes (text-foreground, etc). If the `dark` class the landing
 * page's toggle puts on <html> reaches those tokens, text renders near-white on those
 * hardcoded light backgrounds.
 *
 * The obvious fix — nest a next-themes <ThemeProvider forcedTheme="light"> here — is a
 * documented no-op: next-themes short-circuits to `<>{children}</>` whenever it detects
 * an existing theme context, silently dropping every prop including forcedTheme
 * (verified against the installed next-themes 0.4.6 source; see
 * https://github.com/pacocoursey/next-themes/issues/254).
 *
 * So instead we strip the `dark` class ourselves. A plain one-shot removal on mount
 * isn't enough: the ROOT ThemeProvider (an ancestor) has its own effect that
 * re-applies the persisted theme on every mount, and — because ancestor effects run
 * after descendant effects within the same phase (layout or passive), regardless of
 * which hook we pick — that re-application always wins a one-shot race and puts
 * `dark` right back (confirmed via e2e: the class reappeared within milliseconds of
 * being removed). A MutationObserver instead keeps re-stripping the class for as long
 * as an (app) route is mounted, and restores it on unmount so the landing page's
 * chosen theme is preserved when the user navigates away.
 */
export function ForceLightTheme() {
  const { resolvedTheme } = useTheme();

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;

    const strip = () => {
      if (root.classList.contains("dark")) {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };

    strip();
    const observer = new MutationObserver(strip);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      if (resolvedTheme === "dark") {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      }
    };
  }, [resolvedTheme]);

  return null;
}
