"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import type { DemoLocationWithCoords, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InvestigateButtonProps {
  location: DemoLocationWithCoords;
  /** Optional mode override; otherwise uses location.mode from the fixture. */
  mode?: Mode;
  className?: string;
}

export function InvestigateButton({ location, mode, className }: InvestigateButtonProps) {
  const { start, status, location: active } = useInvestigation();
  const isActive = active?.id === location.id;
  const isStreaming = isActive && status === "streaming";
  return (
    <button
      type="button"
      disabled={isStreaming}
      onClick={() => start(location, mode)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.18em]",
        "border border-reservoir-300 bg-reservoir-50 text-reservoir-700",
        "transition-colors hover:bg-reservoir-100 disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
      aria-label={`Investigate ${location.label}`}
    >
      {isStreaming ? "Investigating…" : "Investigate"}
      <span aria-hidden className="text-reservoir-700">→</span>
    </button>
  );
}

interface ModeToggleProps {
  value: Mode;
  onChange(value: Mode): void;
  className?: string;
}

/** Two-state segmented control: Personal ↔ Transparency. */
export function ModeToggle({ value, onChange, className }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Investigation mode"
      className={cn(
        "inline-flex rounded-full border border-border bg-background p-0.5 text-[10px] uppercase tracking-[0.18em]",
        className,
      )}
    >
      {(["personal", "transparency"] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              "px-2.5 py-1 rounded-full transition-colors",
              active
                ? "bg-reservoir-100 text-reservoir-700"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
