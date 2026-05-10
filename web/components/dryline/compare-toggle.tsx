"use client";

import * as React from "react";
import { useMultiInvestigation } from "./investigation-provider";
import { cn } from "@/lib/utils";

/**
 * Compare-mode switch. Lives in the header next to the global mode
 * toggle. When on, the page splits the right panel into two slots.
 */
export function CompareToggle({ className }: { className?: string }) {
  const { compareMode, setCompareMode, resetAll, primary, secondary } = useMultiInvestigation();
  const onClick = () => {
    // Turning compare OFF clears the secondary so we don't strand it.
    if (compareMode && secondary.location) {
      secondary.reset();
    }
    setCompareMode(!compareMode);
  };
  const showReset = compareMode && (primary.location || secondary.location);

  return (
    <span className={cn("inline-flex items-stretch border border-ink", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={compareMode}
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5",
          "font-mono text-[10px] tracking-[0.18em] uppercase",
          compareMode ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-deep",
        )}
        title={
          compareMode
            ? "Compare mode is ON. Click to return to single-address mode."
            : "Compare mode — investigate two addresses at once and read them side by side."
        }
      >
        <span aria-hidden>⇄</span>
        Compare
      </button>
      {showReset ? (
        <button
          type="button"
          onClick={resetAll}
          className={cn(
            "px-1.5 border-l border-ink/40",
            "font-mono text-[10px] tracking-[0.18em] uppercase",
            compareMode ? "bg-ink text-paper hover:bg-rust" : "bg-transparent text-ink hover:bg-paper-deep",
          )}
          title="Reset both compare-mode investigations"
          aria-label="Reset both investigations"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
