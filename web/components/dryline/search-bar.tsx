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
  kind: "staged" | "known" | "live";
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

interface LiveSuggestion {
  label: string;
  city: string;
  county: string;
  region: string;
  lat: number;
  lng: number;
  placeId: string;
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
  const [liveHits, setLiveHits] = React.useState<LiveSuggestion[]>([]);
  const [liveLoading, setLiveLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const liveAbortRef = React.useRef<AbortController | null>(null);

  // Debounced Nominatim autocomplete. Fires only for queries ≥ 3 chars,
  // 300ms after the last keystroke. Aborts any in-flight request so the
  // dropdown reflects the latest query, not whichever request returns last.
  React.useEffect(() => {
    const text = q.trim();
    // 2-char threshold so users see live results almost as soon as they
    // start typing (was 3, which made "TX" only show local results).
    if (text.length < 2) {
      setLiveHits([]);
      setLiveLoading(false);
      return;
    }
    setLiveLoading(true);
    const t = setTimeout(async () => {
      liveAbortRef.current?.abort();
      const ac = new AbortController();
      liveAbortRef.current = ac;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(text)}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setLiveHits([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: LiveSuggestion[] };
        setLiveHits(data.suggestions ?? []);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setLiveHits([]);
      } finally {
        setLiveLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

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
    const liveMapped: Candidate[] = liveHits.map((h) => ({
      kind: "live",
      id: `live:${h.placeId}`,
      label: h.label,
      sub: h.region,
      region: h.region,
      city: h.city,
      county: h.county,
      approxLatLng: { lat: h.lat, lng: h.lng },
      mode: "personal",
    }));
    const needle = q.trim().toLowerCase();
    if (!needle) return [...stagedMapped, ...knownMapped].slice(0, 8);
    // When the user is typing, prioritize:
    //   1. local fuzzy matches against staged/known (instant, no network)
    //   2. live Nominatim hits (real Texas addresses)
    // Dedup live hits that already appear in the local list by label.
    const localMatches = [...stagedMapped, ...knownMapped].filter((c) =>
      c.label.toLowerCase().includes(needle) ||
      c.sub.toLowerCase().includes(needle) ||
      c.city.toLowerCase().includes(needle) ||
      c.county.toLowerCase().includes(needle),
    );
    const localLabels = new Set(localMatches.map((c) => c.label.toLowerCase()));
    const liveDedup = liveMapped.filter((c) => !localLabels.has(c.label.toLowerCase()));
    return [...localMatches, ...liveDedup].slice(0, 10);
  }, [q, staged, liveHits]);

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

  /**
   * Free-text fallback: turn whatever the user typed into a Candidate that
   * the orchestrator can hand to /api/investigate. resolve_location does
   * the real geocoding server-side; we just need plausible city/county
   * tokens here.
   *
   * Heuristics:
   *  - "City, County, TX"  → city = first, county = second
   *  - "City, TX 78676"     → city = first; county empty (resolve_location handles)
   *  - "City, TX"           → city = first; county empty
   *  - bare city            → use as both city and county (Nominatim usually
   *                           handles, falls through to TX-FIPS map)
   */
  const commitFreeText = React.useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (text.length < 3) return;
      const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
      const city = parts[0] ?? text;
      const second = parts[1] ?? "";
      // If second token looks like just a state abbreviation, drop it.
      const county = /^[A-Z]{2}$/.test(second) || /^[A-Z]{2}\s/.test(second) ? "" : second.replace(/county$/i, "").trim();
      const fc: DemoLocationWithCoords = {
        id: `freetext:${text.toLowerCase()}`,
        label: text,
        city,
        county: county || city, // best guess; resolve_location will override
        region: "Free-text search",
        mode: "personal",
        headlineStory: `Live investigation for ${text}. No curated narrative.`,
        approxLatLng: undefined,
        live: false,
      };
      onPick(fc);
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
      // Prefer a highlighted candidate; fall back to firing the free-text query.
      if (candidates.length > 0 && q.trim()) {
        commit(candidates[hl]);
      } else if (q.trim()) {
        commitFreeText(q);
      } else if (candidates.length > 0) {
        commit(candidates[hl]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const display = open ? q : activeLabel ?? q;

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <div
        className={cn(
          // Larger tap target on mobile (44px), tighter on desktop.
          "flex items-center gap-2 px-3 py-2.5 lg:py-1.5 bg-card transition-colors",
          "border",
          open ? "border-ink" : "border-rule",
        )}
      >
        <span className="font-mono text-[13px] lg:text-[11px] text-tideline">⌕</span>
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
          // 16px on mobile prevents iOS from zooming when the input is
          // focused; 13px is fine on desktop.
          className="flex-1 min-w-0 bg-transparent text-[16px] lg:text-[13px] text-ink placeholder:text-tideline outline-none border-none"
        />
        <span className="hidden lg:inline-block font-mono text-[9.5px] tracking-[0.1em] text-tideline border border-rule px-1.5">
          ⌘K
        </span>
      </div>

      {/* Empty-state: dropdown opens but no matches yet — show search-in-
          progress feedback + free-text fallback so the user understands
          something IS happening. */}
      {open && candidates.length === 0 && q.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-paper border border-ink shadow-paper z-[100]">
          <div className="flex items-center justify-between px-3 py-2 font-mono text-[9.5px] tracking-[0.18em] text-tideline border-b border-rule">
            <span>{liveLoading ? "Searching Texas addresses…" : "No Texas matches"}</span>
            {liveLoading ? (
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-aquifer animate-dryline-pulse" />
            ) : null}
          </div>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              commitFreeText(q);
            }}
            className="block w-full text-left px-3 py-2.5 hover:bg-paper-deep cursor-pointer"
          >
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-serif text-[14.5px] font-medium text-ink">
                Investigate &ldquo;{q.trim()}&rdquo;
              </span>
              <span className="font-mono text-[8.5px] tracking-[0.16em] text-aquifer border border-aquifer/60 px-1.5 py-px">
                RUN ↗
              </span>
            </div>
            <div className="text-[11.5px] text-tideline mt-0.5">
              Resolves the address via Nominatim + Census, then fans out all 8 tools against real public APIs. Tip: include city + county for the most reliable resolution.
            </div>
          </button>
          <div className="px-3 py-2 font-mono text-[9.5px] tracking-[0.16em] text-tideline border-t border-rule">
            ↵ run · esc close
          </div>
        </div>
      ) : null}

      {open && candidates.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-paper border border-ink shadow-paper z-[100] max-h-[380px] overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 font-mono text-[9.5px] tracking-[0.18em] text-tideline border-b border-rule">
            <span>
              {q.trim()
                ? `${candidates.length} MATCH${candidates.length === 1 ? "" : "ES"}`
                : "SAMPLES · TEXAS CITIES"}
            </span>
            {liveLoading ? <span className="text-aquifer">SEARCHING TX ADDRESSES…</span> : null}
          </div>
          {candidates.map((c, i) => {
            const chipLabel =
              c.kind === "staged" ? "SAMPLE" : c.kind === "live" ? "TX MATCH" : "TX CITY";
            const chipTitle =
              c.kind === "staged"
                ? "Sample Texas address with a curated story walkthrough."
                : c.kind === "live"
                ? "Live Texas address from OpenStreetMap — runs a fresh investigation against public APIs."
                : "Texas city — runs a fresh investigation against live public APIs.";
            return (
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
                  <span
                    title={chipTitle}
                    className={cn(
                      "shrink-0 font-mono text-[8.5px] tracking-[0.16em] px-1.5 py-px border",
                      c.kind === "staged"
                        ? "text-aquifer border-aquifer/60"
                        : c.kind === "live"
                        ? "text-ink border-ink/60 bg-paper-deep"
                        : "text-tideline border-rule",
                    )}
                  >
                    {chipLabel}
                  </span>
                </div>
                <div className="text-[11.5px] text-tideline mt-0.5">{c.sub}</div>
              </button>
            );
          })}
          <div className="flex justify-between px-3 py-2 font-mono text-[9.5px] tracking-[0.16em] text-tideline">
            <span>↑↓ NAVIGATE  ↵ SELECT  ESC CLOSE</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
