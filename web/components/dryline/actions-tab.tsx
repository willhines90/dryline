"use client";

import * as React from "react";
import { useInvestigation, useMultiInvestigation } from "./investigation-provider";
import { PublicCommentDraft } from "./public-comment-draft";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * ActionsTab — full-screen drawer holding the editable artifact draft.
 * No longer self-triggering. The inline ActionCard inside the
 * InvestigationPanel is the primary entry point; this just renders the
 * drawer when the provider's `actionsOpen` is true.
 */
export function ActionsTab() {
  const { artifact } = useInvestigation();
  const { actionsOpen, setActionsOpen } = useMultiInvestigation();

  // Reset when the investigation resets and the artifact is gone.
  React.useEffect(() => {
    if (!artifact && actionsOpen) setActionsOpen(false);
  }, [artifact, actionsOpen, setActionsOpen]);

  // Esc closes the drawer.
  React.useEffect(() => {
    if (!actionsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionsOpen, setActionsOpen]);

  if (!artifact) return null;

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden
        onClick={() => setActionsOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-ink/40 transition-opacity duration-200",
          actionsOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Drafted action artifact"
        className={cn(
          "fixed right-0 top-0 z-40 h-full bg-paper border-l border-ink shadow-paper",
          "w-full max-w-xl flex flex-col",
          "transition-transform duration-[280ms] ease-out",
          actionsOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!actionsOpen}
      >
        <header className="px-6 py-4 border-b border-rule flex items-baseline justify-between bg-paper-deep">
          <div className="min-w-0">
            <div className="dryline-label">Drafted action · review before sending</div>
            <h3 className="font-serif text-[19px] tracking-tight mt-0.5 text-ink truncate">
              {artifact.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActionsOpen(false)}
            className="ml-3 font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink border border-rule px-2 py-1 transition-colors shrink-0"
            aria-label="Close action draft"
          >
            Close ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <PublicCommentDraft artifact={artifact} />
        </div>
      </aside>
    </>
  );
}

/**
 * Inline action card. Surfaces in the InvestigationPanel as the natural
 * end of the flow: "Here's what you can do." Replaces the right-edge
 * floating handle so the call-to-action is no longer hidden UI.
 */
/** First non-heading paragraph from the artifact's markdown — used as the inline preview. */
function previewFromMarkdown(markdown: string, maxLen = 220): string {
  const lines = markdown.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith(">") || line.startsWith("---")) continue;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const item = line.replace(/^[*-]\s+/, "");
      return item.length > maxLen ? item.slice(0, maxLen - 1) + "…" : item;
    }
    return line.length > maxLen ? line.slice(0, maxLen - 1) + "…" : line;
  }
  return "";
}

export function ActionCard() {
  const { artifact, status } = useInvestigation();
  const { setActionsOpen } = useMultiInvestigation();

  if (!artifact) return null;

  const ready = status === "done";
  const summary = previewFromMarkdown(artifact.markdown);

  return (
    <article
      className={cn(
        "border border-aquifer bg-[linear-gradient(180deg,#f5fafb_0%,#eaf2f4_100%)] px-5 py-4 shadow-paper",
        "relative overflow-hidden",
      )}
    >
      {/* Subtle aquifer accent stripe along the left edge */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1 bg-aquifer"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-aquifer flex items-center gap-1.5">
            <span aria-hidden>↪</span>
            <span>Suggested next step</span>
          </div>
          <h3 className="font-serif text-[18px] leading-tight tracking-[-0.008em] mt-1 text-ink">
            {artifact.title}
          </h3>
          {summary ? (
            <p className="font-serif italic text-[13.5px] text-tideline mt-1.5 leading-snug line-clamp-3">
              {summary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-tideline">
          Drafted from this investigation · review before sending
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            track("action_opened", { kind: artifact.kind });
            setActionsOpen(true);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-2",
            "font-mono text-[10.5px] tracking-[0.18em] uppercase",
            "transition-colors",
            ready
              ? "bg-aquifer text-paper border border-aquifer hover:bg-tide hover:border-tide"
              : "bg-paper-deep text-tideline border border-rule cursor-not-allowed",
          )}
          title={
            ready
              ? "Open the full action draft for review and editing"
              : "The draft becomes editable once the investigation finishes."
          }
        >
          {ready ? "Open draft" : "Drafting…"}
          <span aria-hidden>→</span>
        </button>
      </div>
    </article>
  );
}
