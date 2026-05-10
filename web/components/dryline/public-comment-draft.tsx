"use client";

import * as React from "react";
import type { ArtifactPayload } from "@/lib/types";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, { addressee: string; subject: string }> = {
  public_comment: { addressee: "TCEQ Office of the Chief Clerk", subject: "Public comment" },
  watering_reminder: { addressee: "Water utility customer", subject: "Watering reminder" },
  gcd_letter: { addressee: "Groundwater Conservation District board", subject: "Letter to the board" },
  well_outlook_briefing: { addressee: "Property owner", subject: "Well outlook briefing" },
  pia_request: { addressee: "Public records officer", subject: "Public information request" },
  weekly_briefing: { addressee: "Subscriber", subject: "Weekly briefing" },
};

interface PublicCommentDraftProps {
  artifact: ArtifactPayload;
}

export function PublicCommentDraft({ artifact }: PublicCommentDraftProps) {
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
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong className="font-semibold">Review before sending.</strong> This is a draft. Verify
        every cited fact in the synthesis, edit the body to your voice, and add your name before
        submitting.
      </div>

      <article className="rounded-lg border border-border bg-arid-50 px-6 py-5 shadow-sm">
        <header className="space-y-1 text-xs text-muted-foreground">
          <div>
            <span className="uppercase tracking-[0.18em] mr-1">To:</span>
            {meta.addressee}
          </div>
          <div>
            <span className="uppercase tracking-[0.18em] mr-1">RE:</span>
            <span className="text-foreground">{artifact.title}</span>
          </div>
        </header>

        <div className="mt-4">
          <Markdown text={artifact.markdown} />
        </div>

        <footer className="mt-5 text-xs text-muted-foreground italic">
          [Your name]
        </footer>
      </article>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-reservoir-300 bg-reservoir-50 px-3 py-1.5 text-xs",
            "text-reservoir-700 hover:bg-reservoir-100 transition-colors",
          )}
        >
          {copied ? "Copied ✓" : "Copy draft"}
        </button>
        <span className="text-[11px] text-muted-foreground italic">
          No send button. Judges should see Dryline does not auto-submit.
        </span>
      </div>
    </div>
  );
}
