"use client";

import * as React from "react";
import { useInvestigation } from "./investigation-provider";
import { PublicCommentDraft } from "./public-comment-draft";
import { cn } from "@/lib/utils";

/**
 * ActionsTab — slides in from the right edge after the artifact event
 * arrives. Default closed; opens with a 280 ms transition. The handle on
 * the right edge reads "Action ↗".
 */
export function ActionsTab() {
  const { artifact, status } = useInvestigation();
  const [open, setOpen] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  // When a new artifact arrives, briefly auto-pulse the handle to draw attention
  // but do not auto-open — the user controls reveal.
  React.useEffect(() => {
    if (artifact && !acknowledged) {
      setAcknowledged(true);
    }
  }, [artifact, acknowledged]);

  // Reset when the investigation resets (artifact becomes null while we were open)
  React.useEffect(() => {
    if (!artifact) {
      setOpen(false);
      setAcknowledged(false);
    }
  }, [artifact]);

  if (!artifact) return null;

  const shouldNudge = status === "done" && acknowledged && !open;

  return (
    <>
      {/* Pulsing halo behind the handle, more visible than animate-pulse alone */}
      {shouldNudge ? (
        <span
          aria-hidden
          className="fixed right-0 top-1/2 -translate-y-1/2 z-20 h-32 w-9 rounded-l-lg bg-aquifer/40 animate-dryline-pulse"
        />
      ) : null}
      {/* Edge handle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-30",
          "h-32 w-9 rounded-l-lg border border-r-0 border-aquifer/60",
          "bg-aquifer text-paper shadow-paper",
          "flex items-center justify-center",
          "transition-all duration-200 hover:bg-tide hover:scale-105",
          shouldNudge ? "ring-2 ring-spring/80 ring-offset-0" : "",
        )}
        aria-label={open ? "Close actions" : "Open drafted artifact"}
      >
        <span
          className="font-mono text-[11px] uppercase tracking-[0.32em]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {open ? "Close" : "Action ↗"}
        </span>
      </button>

      {/* Slide-in panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-20 h-full bg-arid-50 border-l border-border shadow-xl",
          "w-full max-w-xl flex flex-col",
          "transition-transform duration-[280ms] ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="px-6 py-4 border-b border-border flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Drafted artifact
            </div>
            <h3 className="font-serif text-lg tracking-tight">{artifact.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <PublicCommentDraft artifact={artifact} />
        </div>
      </aside>
    </>
  );
}
