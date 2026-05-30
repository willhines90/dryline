"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * In-header guide popover. Anchored to a "?" button. Surfaces a one-line
 * explanation of every control in the header — built so a first-time
 * viewer doesn't have to hover each toggle to learn what it does.
 */
export function HeaderHelp({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="What do these controls do?"
        title="What do these controls do?"
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 border",
          "font-mono text-[11px] tracking-[0.18em] uppercase transition-colors",
          open
            ? "bg-aquifer text-paper border-aquifer"
            : "bg-transparent text-tideline border-rule hover:text-ink hover:border-ink/40",
        )}
      >
        ?
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Header controls reference"
          className={cn(
            "absolute right-0 top-[calc(100%+6px)] z-[60]",
            "w-[340px] border border-ink bg-paper shadow-paper",
          )}
        >
          <div className="px-3.5 py-2.5 border-b border-rule bg-paper-deep">
            <div className="dryline-label">Header controls</div>
            <div className="font-serif italic text-[12.5px] text-tideline leading-snug mt-0.5">
              What each switch does, in one line.
            </div>
          </div>
          <ul className="divide-y divide-rule">
            <Row
              chip="Search"
              label="Search any Texas address"
              body="Type a city, county, or a pinned sample. Hit Enter on free text to run a fresh investigation against live public APIs."
            />
            <Row
              chip="Personal"
              label="Personal view"
              body='Reads the address as a homeowner — drought, drinking-water compliance, aquifer trend. Headline framing: "Will the water last here?"'
            />
            <Row
              chip="Transparency"
              label="Transparency view"
              body='Reads the address as a neighbor or reporter — large industrial dischargers, active permits, contested groundwater. Headline framing: "Who else is drinking your aquifer?"'
            />
            <Row
              chip="⇄ Compare"
              label="Compare two addresses"
              body="Splits the right panel into two slots so you can investigate two addresses at once and read them side by side."
            />
            <Row
              chip="○ Agentic"
              label="Agentic mode"
              body="Lets an LLM choose which data tools to call for each address (slower, ≈30 s, but the agent's judgment is visible). Off = fast deterministic 9-tool fan-out."
            />
            <Row
              chip="About"
              label="About Dryline"
              body="What Dryline is, how to read the synthesis, and where every data source comes from."
            />
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ chip, label, body }: { chip: string; label: string; body: string }) {
  return (
    <li className="px-3.5 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[9.5px] tracking-[0.16em] uppercase text-aquifer border border-aquifer/50 bg-paper-deep px-1.5 py-px">
          {chip}
        </span>
        <span className="font-serif text-[13.5px] text-ink leading-tight">{label}</span>
      </div>
      <p className="font-serif text-[12.5px] text-tideline leading-snug mt-1">{body}</p>
    </li>
  );
}
