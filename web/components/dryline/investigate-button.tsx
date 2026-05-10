"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import type { DemoLocationWithCoords, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InvestigateButtonProps {
  location: DemoLocationWithCoords;
  mode?: Mode;
  className?: string;
}

/**
 * Primary CTA. Square corners, ink-on-paper fill, mono uppercase tracking
 * — matches the design's solid `.btn` primitive.
 */
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
        "inline-flex items-center gap-2 px-3.5 py-2",
        "bg-ink text-paper border border-ink",
        "font-mono text-[10.5px] tracking-[0.18em] uppercase",
        "transition-colors hover:bg-aquifer hover:border-aquifer disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
      aria-label={`Investigate ${location.label}`}
    >
      {isStreaming ? "Investigating…" : "Investigate"}
      <span aria-hidden>→</span>
    </button>
  );
}

interface ModeToggleProps {
  value: Mode;
  onChange(value: Mode): void;
  className?: string;
}

/**
 * Two-state segmented control: Personal ↔ Transparency. Per the design's
 * inline ModeToggle — square corners, ink-bordered, monospace caps.
 */
export function ModeToggle({ value, onChange, className }: ModeToggleProps) {
  const opts: { k: Mode; label: string; q: string }[] = [
    { k: "personal", label: "Personal", q: "Will the water last here?" },
    { k: "transparency", label: "Transparency", q: "Who's drinking your aquifer?" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Investigation mode"
      className={cn("inline-flex border border-ink", className)}
    >
      {opts.map((o, i) => {
        const active = value === o.k;
        return (
          <button
            key={o.k}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.q}
            onClick={() => onChange(o.k)}
            className={cn(
              "px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
              i > 0 ? "border-l border-ink" : "",
              active ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-deep",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
