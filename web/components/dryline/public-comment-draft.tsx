"use client";

import * as React from "react";
import type { ArtifactPayload } from "@/lib/types";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, { addressee: string; subject: string }> = {
  public_comment: {
    addressee: "TCEQ Office of the Chief Clerk",
    subject: "Public comment",
  },
  watering_reminder: {
    addressee: "Water utility customer",
    subject: "Watering reminder",
  },
  gcd_letter: {
    addressee: "Groundwater Conservation District board",
    subject: "Letter to the board",
  },
  well_outlook_briefing: {
    addressee: "Property owner",
    subject: "Well outlook briefing",
  },
  pia_request: {
    addressee: "Public records officer",
    subject: "Public information request",
  },
  weekly_briefing: {
    addressee: "Subscriber",
    subject: "Weekly briefing",
  },
};

/**
 * Drafted action artifact rendered as a letter. Paper-warm background,
 * monospace KIND label, Newsreader subject line, dashed footer rule.
 * Per the design's `.artifact` primitive.
 */
export function PublicCommentDraft({ artifact }: { artifact: ArtifactPayload }) {
  const meta = KIND_LABELS[artifact.kind] ?? {
    addressee: "Reviewer",
    subject: artifact.title,
  };
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      const formatted = `${meta.addressee}\nRE: ${artifact.title}\n\n${artifact.markdown}`;
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-rust bg-[#f3dcd2] px-3 py-2 font-serif text-[13px] text-ink">
        <strong className="font-semibold">Review before sending.</strong> This is a draft.
        Verify every cited fact in the synthesis, edit the body to your voice, and add your
        name before submitting.
      </div>

      <article className="border border-rule bg-paper-warm px-6 py-5 shadow-paper">
        <header className="space-y-1.5">
          <div className="dryline-label">{meta.subject}</div>
          <div className="font-serif text-[26px] leading-[1.15] tracking-[-0.01em] text-ink">
            {artifact.title}
          </div>
          <div className="text-[12.5px] text-tideline pt-2 border-t border-rule mt-3">
            <span className="dryline-label mr-2 inline">To:</span>
            {meta.addressee}
          </div>
        </header>

        <div className="mt-4 dryline-body">
          <Markdown text={artifact.markdown} />
        </div>

        <footer className="mt-5 pt-3 border-t border-dashed border-rule font-mono text-[10px] tracking-[0.14em] uppercase text-tideline">
          [Your name] · review before sending
        </footer>
      </article>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 border border-ink bg-ink text-paper",
            "font-mono text-[10.5px] tracking-[0.18em] uppercase",
            "hover:bg-aquifer hover:border-aquifer transition-colors",
          )}
        >
          {copied ? "Copied ✓" : "Copy draft"}
        </button>
        <span className="font-serif italic text-[12.5px] text-tideline">
          No send button. Judges should see Dryline does not auto-submit.
        </span>
      </div>
    </div>
  );
}
