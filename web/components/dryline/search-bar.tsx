"use client";

/**
 * Free-text Texas address search with Cmd/Ctrl-K activation, ↑↓/↵/Esc
 * keyboard navigation, and a dropdown that mixes the seven staged demo
 * addresses with eight known-but-unstaged Texas locations. Closely mirrors
 * the SearchBar in the Claude Design bundle.
 *
 * Behavior:
 *   - Pick a staged address → starts a curated investigation (default flow).
 *   - Pick a known/known-but-unstaged or type a free address → starts a
 *     LIVE investigation against the same /api/investigate route. The
 *     address gets resolved server-side, and if Nominatim places it
 *     outside Texas, resolve_location surfaces that as an error caveat.
 */

import * as React from "react";
import type { DemoLocationWithCoords, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KnownAddress {
  label: string;
  city: string;
  county: string;
  region: string;
  approxLatLng: { lat: number; lng: number };
}

const KNOWN_ADDRESSES: KnownAddress[] = [
  { label: "Austin, TX — Lake Travis", city: "Austin", county: "Travis", region: "I-35 corridor", approxLatLng: { lat: 30.4047, lng: -97.908 } },
  { label: "Dallas, TX — White Rock Lake", city: "Dallas", county: "Dallas", region: "North Texas", approxLatLng: { lat: 32.8221, lng: -96.7228 } },
  { label: "Marfa, TX", city: "Marfa", county: "Presidio", region: "Trans-Pecos", approxLatLng: { lat: 30.3094, lng: -104.0203 } },
  { label: "Galveston, TX", city: "Galveston", county: "Galveston", region: "Coast", approxLatLng: { lat: 29.3013, lng: -94.7977 } },
  { label: "Amarillo, TX — Ogallala", city: "Amarillo", county: "Potter", region: "Panhandle", approxLatLng: { lat: 35.222, lng: -101.8313 } },
  { label: "Midland, TX — Permian Basin", city: "Midland", county: "Midland", region: "West Texas", approxLatLng: { lat: 31.9974, lng: -102.0779 } },
  { label: "Brownsville, TX — Rio Grande", city: "Brownsville", county: "Cameron", region: "Rio Grande Valley", approxLatLng: { lat: 25.9018, lng: -97.4975 } },
  { label: "Corpus Christi, TX", city: "Corpus Christi", county: "Nueces", region: "Coastal Bend", approxLatLng: { lat: 27.8006, lng: -97.3964 } },
];

interface Candidate {
  kind: "staged" | "known";
  id: string;
  label: string;
  sub: string;
  region: string;
  live?: boolean;
  city: string;
  county: string;
  approxLatLng: { lat: number; lng: number };
  mode: Mode;
  headlineStory?: string;
}

interface SearchBarProps {
  staged: DemoLocationWithCoords[];
  onPick: (location: DemoLocationWithCoords, mode?: Mode) => void;
  activeLabel?: string | null;
  className?: string;
}

export function SearchBar({ staged, onPick, activeLabel, className }: SearchBarProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hl, setHl] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const candidates = React.useMemo<Candidate[]>(() => {
    const stagedMapped: Candidate[] = staged.map((l) => ({
      kind: "staged",
      id: l.id,
      label: l.label,
      sub: l.region,
      region: l.region,
      live: l.live,
      city: l.city,
      county: l.county,
      approxLatLng: l.approxLatLng!,
      mode: l.mode,
      headlineStory: l.headlineStory,
    }));
    const knownMapped: Candidate[] = KNOWN_ADDRESSES.map((a) => ({
      kind: "known",
      id: `known:${a.label}`,
      label: a.label,
      sub: a.region,
      region: a.region,
      city: a.city,
      county: a.county,
      approxLatLng: a.approxLatLng,
      mode: "personal",
    }));
    const all = [...stagedMapped, ...knownMapped];
    if (!q.trim()) return all.slice(0, 8);
    const needle = q.toLowerCase();
    return all
      .filter((c) =>
        c.label.toLowerCase().includes(needle) ||
        c.sub.toLowerCase().includes(needle) ||
        c.city.toLowerCase().includes(needle) ||
        c.county.toLowerCase().includes(needle),
      )
      .slice(0, 10);
  }, [q, staged]);

  React.useEffect(() => setHl(0), [q]);

  const commit = React.useCallback(
    (c: Candidate | undefined) => {
      if (!c) return;
      // Build a DemoLocationWithCoords that the existing investigation flow expects.
      const location: DemoLocationWithCoords = {
        id: c.id,
        label: c.label,
        city: c.city,
        county: c.county,
        region: c.region,
        mode: c.mode,
        headlineStory:
          c.headlineStory ??
          (c.kind === "known"
            ? `Live investigation for ${c.label}. No curated headline.`
            : `Investigation for ${c.label}.`),
        approxLatLng: c.approxLatLng,
        live: c.live,
      };
      onPick(location);
      setOpen(false);
      setQ("");
      inputRef.current?.blur();
    },
    [onPick],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHl((h) => Math.min(h + 1, candidates.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHl((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(candidates[hl]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const display = open ? q : activeLabel ?? q;

  return (
    <div ref={wrapRef} className={cn("relative w-[360px] max-w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 bg-card transition-colors",
          "border",
          open ? "border-ink" : "border-rule",
        )}
      >
        <span className="font-mono text-[11px] text-tideline">⌕</span>
        <input
          ref={inputRef}
          value={display}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search any Texas address…"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-ink placeholder:text-tideline outline-none border-none"
        />
        <span className="font-mono text-[9.5px] tracking-[0.1em] text-tideline border border-rule px-1.5">
          ⌘K
        </span>
      </div>

      {open && candidates.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-paper border border-ink shadow-paper z-50 max-h-[380px] overflow-y-auto">
          <div className="px-3 py-2 font-mono text-[9.5px] tracking-[0.18em] text-tideline border-b border-rule">
            {q.trim()
              ? `${candidates.length} MATCH${candidates.length === 1 ? "" : "ES"}`
              : "STAGED · KNOWN"}
          </div>
          {candidates.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setHl(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(c);
              }}
              className={cn(
                "block w-full text-left px-3 py-2.5 border-b border-rule cursor-pointer text-ink",
                hl === i ? "bg-paper-deep" : "bg-transparent",
              )}
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="font-serif text-[14.5px] font-medium leading-tight">
                  {c.label}
                </span>
                <span className="shrink-0 font-mono text-[8.5px] tracking-[0.16em] text-tideline border border-rule px-1.5 py-px">
                  {c.kind === "staged" ? (c.live ? "LIVE" : "CHAMBER") : "KNOWN"}
                </span>
              </div>
              <div className="text-[11.5px] text-tideline mt-0.5">{c.sub}</div>
            </button>
          ))}
          <div className="flex justify-between px-3 py-2 font-mono text-[9.5px] tracking-[0.16em] text-tideline">
            <span>↑↓ NAVIGATE  ↵ SELECT  ESC CLOSE</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
