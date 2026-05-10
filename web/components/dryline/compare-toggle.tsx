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

  return (
    <button
      type="button"
      role="switch"
      aria-checked={compareMode}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink",
        "font-mono text-[10px] tracking-[0.18em] uppercase",
        compareMode ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-deep",
        className,
      )}
      title={compareMode ? "Switch to single-investigation mode" : "Compare two addresses side by side"}
    >
      <span aria-hidden>⇄</span>
      Compare
      {compareMode && (primary.location || secondary.location) ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetAll();
          }}
          className="ml-1 px-1 text-[9px] hover:underline"
          title="Reset both investigations"
        >
          ×
        </button>
      ) : null}
    </button>
  );
}
