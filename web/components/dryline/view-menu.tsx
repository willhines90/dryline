"use client";

import * as React from "react";
import { useMultiInvestigation } from "./investigation-provider";
import { useDarkMode } from "./dark-mode-toggle";
import { cn } from "@/lib/utils";

/**
 * Header overflow menu — collapses the secondary controls (Compare, Live
 * map, Agentic, "What do these do?") into a single chip so the top bar
 * stays focused on the primary actions: search + mode + about. Each row
 * doubles as a switch with its current state visible inline.
 */
export function ViewMenu({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const { compareMode, setCompareMode, agenticMode, setAgenticMode, primary, secondary } =
    useMultiInvestigation();
  const { dark, setDark } = useDarkMode();

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

  const toggleCompare = () => {
    if (compareMode && secondary.location) secondary.reset();
    setCompareMode(!compareMode);
  };

  // The summary string is what shows next to "View" so a glance at the
  // chip tells you whether anything non-default is active.
  const activeBits: string[] = [];
  if (compareMode) activeBits.push("compare");
  if (dark) activeBits.push("live map");
  if (agenticMode) activeBits.push("agentic");
  const summary = activeBits.length ? activeBits.join(" · ") : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="View options — compare, live map, agentic mode."
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 border",
          "font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
          summary || open
            ? "bg-paper-deep text-ink border-ink/60"
            : "bg-transparent text-tideline border-rule hover:text-ink hover:border-ink/40",
        )}
      >
        View
        {summary ? (
          <span className="text-aquifer normal-case tracking-normal text-[10px]">· {summary}</span>
        ) : null}
        <span aria-hidden className="text-[9px]">{open ? "▴" : "▾"}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="View options"
          className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[320px] border border-ink bg-paper shadow-paper"
        >
          <div className="px-3.5 py-2.5 border-b border-rule bg-paper-deep">
            <div className="dryline-label">View options</div>
            <div className="font-serif italic text-[12.5px] text-tideline leading-snug mt-0.5">
              Optional lenses on the same investigation.
            </div>
          </div>
          <ul className="divide-y divide-rule">
            <SwitchRow
              label="Compare two addresses"
              body="Split the right panel into two slots so two investigations can run side by side."
              active={compareMode}
              onToggle={toggleCompare}
              activeChip={
                compareMode && (primary.location || secondary.location) ? "ACTIVE" : null
              }
            />
            <SwitchRow
              label="Live map"
              body="Dark command-center cartography with glowing rivers and stream gauges. Same data, different lens."
              active={dark}
              onToggle={() => setDark(!dark)}
            />
            <SwitchRow
              label="Agentic mode"
              body="Let an LLM choose which of the 8 data tools to call for each address (≈30 s, judgment visible). Off = fast deterministic fan-out."
              active={agenticMode}
              onToggle={() => setAgenticMode(!agenticMode)}
            />
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SwitchRow({
  label,
  body,
  active,
  onToggle,
  activeChip,
}: {
  label: string;
  body: string;
  active: boolean;
  onToggle: () => void;
  activeChip?: string | null;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={active}
        onClick={onToggle}
        className="block w-full text-left px-3.5 py-2.5 hover:bg-paper-deep cursor-pointer"
      >
        <div className="flex items-baseline gap-2 justify-between">
          <span className="font-serif text-[13.5px] text-ink leading-tight">{label}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {activeChip ? (
              <span className="font-mono text-[8.5px] tracking-[0.16em] uppercase text-aquifer border border-aquifer/60 px-1.5 py-px">
                {activeChip}
              </span>
            ) : null}
            <span
              className={cn(
                "inline-block w-7 h-4 border relative transition-colors",
                active ? "bg-aquifer border-aquifer" : "bg-paper border-rule",
              )}
              aria-hidden
            >
              <span
                className={cn(
                  "absolute top-0.5 w-3 h-3 transition-all",
                  active ? "left-3.5 bg-paper" : "left-0.5 bg-ink/60",
                )}
              />
            </span>
          </span>
        </div>
        <p className="font-serif text-[12.5px] text-tideline leading-snug mt-1 pr-2">{body}</p>
      </button>
    </li>
  );
}
