"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dark / "Live map" mode is retired. The toggle was confusing in the UI
 * (data-layer paint properties didn't repaint on toggle, so flipping it
 * only swapped the basemap — most viewers couldn't tell the difference)
 * and the brand-aligned cartography is the paper variant anyway.
 *
 * The Provider and hook are kept as no-op exports so callers that read
 * `useDarkMode()` continue to work without a wholesale refactor of the
 * 60-plus `dark ? X : Y` branches in texas-map.tsx — they all evaluate
 * to the light/paper branch now.
 */
interface DarkModeContextValue {
  dark: boolean;
  setDark(v: boolean): void;
}

const NOOP_VALUE: DarkModeContextValue = { dark: false, setDark: () => {} };

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useDarkMode(): DarkModeContextValue {
  return NOOP_VALUE;
}

/**
 * Stub kept to avoid breaking any straggling imports. Renders nothing.
 * The Live Map / dark-mode toggle is retired.
 */
export function DarkModeToggle(_: { className?: string }) {
  return null;
}
