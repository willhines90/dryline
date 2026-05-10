"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const LS_KEY = "dryline.dark-mode.v1";

interface DarkModeContextValue {
  dark: boolean;
  setDark(v: boolean): void;
}

const DarkModeCtx = React.createContext<DarkModeContextValue | null>(null);

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const setDark = React.useCallback((v: boolean) => {
    setDarkState(v);
    try {
      localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {
      /* swallow */
    }
  }, []);
  const value = React.useMemo<DarkModeContextValue>(() => ({ dark, setDark }), [dark, setDark]);
  return <DarkModeCtx.Provider value={value}>{children}</DarkModeCtx.Provider>;
}

export function useDarkMode(): DarkModeContextValue {
  const v = React.useContext(DarkModeCtx);
  if (!v) throw new Error("useDarkMode must be inside DarkModeProvider");
  return v;
}

/**
 * "Live mode" header switch. Flips the map to a dark command-center
 * cartography with brighter glowing layers — the OpenGridWorks-style
 * spectacle for demo openings.
 */
export function DarkModeToggle({ className }: { className?: string }) {
  const { dark, setDark } = useDarkMode();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setDark(!dark)}
      title={dark ? "Switch to paper map" : "Switch to dark live-mode map"}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 border",
        "font-mono text-[10px] tracking-[0.18em] uppercase",
        dark
          ? "bg-aquifer text-paper border-aquifer"
          : "bg-transparent text-tideline border-rule hover:text-ink hover:border-ink/40",
        className,
      )}
    >
      <span aria-hidden>{dark ? "◐" : "○"}</span>
      Live
    </button>
  );
}
