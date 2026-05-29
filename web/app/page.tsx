/**
 * Dryline — landing / investigation surface.
 *
 * Strict viewport-locked layout: header + (map | panel) + footer = exactly
 * 100vh. Page never scrolls; the right panel handles its own internal
 * scroll. Map stays visible at all times.
 *
 * Single investigation at a time. Compare-mode was removed because the
 * Primary/Secondary slot UX was confusing — the product reads cleaner
 * as one address at a time with Personal/Transparency as the framing.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import demoAddresses from "../../fixtures/demo-addresses.json";
import { TexasMap } from "@/components/texas-map";
import {
  InvestigationProvider,
  SlotCtx,
  useInvestigation,
  useMultiInvestigation,
} from "@/components/dryline/investigation-provider";
import { ReasoningTrace } from "@/components/dryline/reasoning-trace";
import { SynthesisCard } from "@/components/dryline/synthesis-card";
import { ActionsTab, ActionCard } from "@/components/dryline/actions-tab";
import { DrylineMark } from "@/components/dryline/dryline-mark";
import { DrylineScore } from "@/components/dryline/dryline-score";
import { SearchBar } from "@/components/dryline/search-bar";
import { AboutModal } from "@/components/dryline/about-modal";
import { TraceSkeleton } from "@/components/dryline/trace-skeleton";
import type { DemoLocationWithCoords, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/willhines90/dryline";

export default function HomePage() {
  const locations = (demoAddresses.locations as DemoLocationWithCoords[]).filter(
    (l) => l.approxLatLng,
  );
  return (
    <InvestigationProvider>
      <PageShell locations={locations} />
    </InvestigationProvider>
  );
}

function PageShell({ locations }: { locations: DemoLocationWithCoords[] }) {
  const { primary, startNextAvailable } = useMultiInvestigation();
  const focused = primary.location ?? null;
  const investigationActive = primary.status === "streaming";
  const [aboutOpen, setAboutOpen] = React.useState(false);

  const handlePick = React.useCallback(
    (loc: DemoLocationWithCoords) => startNextAvailable(loc, loc.mode ?? "personal"),
    [startNextAvailable],
  );

  const anyActive = primary.location;

  return (
    <main className="h-svh flex flex-col overflow-hidden bg-background">
      {/* Visually-hidden H1 — the visible wordmark is a `<span>` because
          headers carry their own visual identity, but search engines and
          screen readers need a real h1 to anchor the page semantically. */}
      <h1 className="sr-only">
        Dryline — Investigate Texas water at any address. Drought, reservoirs, drinking water, aquifers, and industrial dischargers, cited.
      </h1>
      <header
        className="shrink-0 relative z-40 bg-paper-deep border-b border-ink/15"
        style={{
          isolation: "isolate",
          // Subtle drop-shadow so the header reads as a distinct layer
          // floating above the map, plus a 2px aquifer accent band along
          // the bottom — a meteorological-dryline ribbon under the bar.
          boxShadow: "0 1px 0 #0d3b6f, 0 6px 16px -8px rgba(7, 23, 31, 0.18)",
        }}
      >
        {/* Mobile: two rows (brand+actions row, search row). lg+: single row
            with absolutely-centered search between brand (left) and
            actions (right). `lg:contents` makes the mobile brand-row
            wrapper "disappear" at lg so its children become siblings of
            the search/spacer in the flex parent. */}
        <div className="relative flex flex-col lg:flex-row lg:items-center px-3 lg:px-4 pt-2.5 pb-2 lg:py-3 gap-2 lg:gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0 lg:contents">
            <Link
              href="/"
              className="flex items-center gap-2.5 no-underline shrink-0 group min-w-0"
              aria-label="Dryline — home"
            >
              <DrylineMark size={26} className="text-dryline shrink-0" />
              <span className="font-wordmark text-[20px] sm:text-[22px] tracking-[-0.02em] text-dryline leading-none">
                Dryline
              </span>
              <span
                aria-hidden
                className="hidden xl:inline-block h-5 w-px bg-ink/15 ml-1.5"
              />
              <span className="hidden xl:inline font-tagline italic text-[13.5px] text-tideline ml-2.5 truncate max-w-[440px]">
                Follow the water at any Texas address — every claim cited.
              </span>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0 lg:ml-auto">
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                title="What Dryline is and where the data comes from."
                className="inline-flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink border border-rule px-2.5 h-9 lg:h-8 transition-colors"
              >
                About
              </button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-9 h-9 lg:w-8 lg:h-8 border border-rule text-tideline hover:text-ink hover:border-ink/40 transition-colors"
                title="View source on GitHub"
                aria-label="View source on GitHub"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
              </a>
            </div>
          </div>
          {/* Search. On mobile it's a full-width second row; on lg+ it's
              absolutely centered so brand+actions can't push it off-axis. */}
          <div className="w-full lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:max-w-[420px] lg:px-2 lg:pointer-events-none" role="search">
            <div className="lg:pointer-events-auto">
              <SearchBar
                staged={locations}
                onPick={handlePick}
                activeLabel={primary.location?.label ?? null}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Layout:
          - Idle: map is the entire content area. Sample addresses live
            on the map as pins AND inside the search dropdown.
          - Investigation active: a panel slides in. On lg+ it sits to
            the right of the map (8/4 split). On mobile it stacks below
            the map (32svh map peek + rest is panel). */}
      <section className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-0 min-h-0">
        <div
          className={cn(
            "min-w-0 relative",
            anyActive
              ? "shrink-0 h-[32svh] lg:h-auto lg:shrink lg:col-span-8 border-b border-rule lg:border-b-0"
              : "flex-1 lg:col-span-12",
          )}
        >
          <TexasMap
            locations={locations}
            focusedLocation={focused}
            investigationActive={investigationActive}
            traces={primary.traces}
            onLocationClick={(loc) =>
              handlePick(loc as DemoLocationWithCoords)
            }
          />
        </div>
        {anyActive ? (
          <aside className="flex-1 lg:flex-none lg:col-span-4 min-w-0 min-h-0 lg:border-l border-rule bg-background flex flex-col overflow-hidden">
            <SlotCtx.Provider value="primary">
              <InvestigationPanel />
            </SlotCtx.Provider>
          </aside>
        ) : null}
      </section>

      <ActionsTab />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}

function InvestigationPanel() {
  const { location, mode, status, reset, error, score, traces, start } = useInvestigation();
  if (!location) return null;
  const showSkeleton = status === "streaming" && traces.length === 0;
  const activeMode: Mode = mode ?? "personal";
  // Flipping the chip kicks a fresh investigation with the other framing.
  // The expensive tool fan-out is the same; only the synthesis prompt and
  // drafted artifacts differ between Personal and Transparency.
  const flipMode = () => {
    const next: Mode = activeMode === "personal" ? "transparency" : "personal";
    start(location, next);
  };
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <header className="px-5 pt-4 pb-3 border-b border-rule">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="dryline-label">Investigating</div>
            <h2 className="font-serif text-[20px] leading-[1.1] tracking-[-0.008em] mt-0.5 truncate text-ink">
              {location.label}
            </h2>
            <div className="font-serif italic text-[13px] text-tideline mt-1">
              {activeMode === "personal"
                ? "Will the water last here?"
                : "Who's drinking your aquifer?"}
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-tideline hover:text-ink border border-rule px-2 py-1 transition-colors shrink-0"
            aria-label="Reset investigation"
          >
            Reset ↺
          </button>
        </div>
        {/* Mode lens — flippable. Replaces the old global header toggle. */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={flipMode}
            disabled={status === "streaming"}
            title={
              activeMode === "personal"
                ? "Reading as a homeowner. Click to re-frame as a watchdog / journalist (Transparency)."
                : "Reading as a watchdog. Click to re-frame as a homeowner (Personal)."
            }
            className={cn(
              "group inline-flex items-center gap-1.5 border px-2 py-1",
              "font-mono text-[9.5px] tracking-[0.16em] uppercase transition-colors",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              activeMode === "personal"
                ? "bg-aquifer/10 border-aquifer text-aquifer hover:bg-aquifer hover:text-paper"
                : "bg-ochre/10 border-ochre-deep text-ochre-deep hover:bg-ochre-deep hover:text-paper",
            )}
          >
            <span aria-hidden className="text-[10px]">{activeMode === "personal" ? "◎" : "◈"}</span>
            <span>Reading as {activeMode === "personal" ? "Homeowner" : "Watchdog"}</span>
            <span aria-hidden className="text-[9px] opacity-60 group-hover:opacity-100">⇄</span>
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 font-mono text-[9.5px] tracking-[0.18em] uppercase">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                status === "streaming" && "bg-aquifer animate-dryline-pulse",
                status === "done" && "bg-kelp",
                status === "error" && "bg-rust",
                status === "idle" && "bg-tideline",
              )}
            />
            <span
              className={cn(
                status === "streaming" && "text-aquifer",
                status === "done" && "text-kelp",
                status === "error" && "text-rust",
                status === "idle" && "text-tideline",
              )}
            >
              {status === "streaming"
                ? "Streaming"
                : status === "done"
                ? "Done"
                : status === "error"
                ? "Error"
                : "Idle"}
            </span>
          </span>
          {error ? <span className="text-rust normal-case tracking-normal">{error}</span> : null}
        </div>
      </header>

      <div className="px-5 py-3 space-y-3.5">
        {status === "error" && error ? (
          <div className="border border-rust bg-paper-warm px-3 py-2.5 text-[12.5px] text-ink">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-rust mb-1">
              Investigation interrupted
            </div>
            <div className="font-serif leading-snug mb-2">{error}</div>
            <button
              type="button"
              onClick={() => start(location, mode ?? "personal")}
              className="font-mono text-[10px] tracking-[0.18em] uppercase border border-ink bg-ink text-paper px-2.5 py-1 mr-2 hover:bg-aquifer hover:border-aquifer transition-colors"
            >
              Retry ↻
            </button>
            <button
              type="button"
              onClick={reset}
              className="font-mono text-[10px] tracking-[0.18em] uppercase border border-ink/40 text-tideline hover:text-ink px-2.5 py-1 transition-colors"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* 1. Headline number — the answer at a glance. */}
        {score ? <DrylineScore score={score} /> : null}

        {/* 2. Cited synthesis — the answer in prose. */}
        <SynthesisCard />

        {/* 3. Action — what to do next, drafted from this investigation. */}
        <ActionCard />

        {/* 4. Reasoning trace — supporting evidence below the headline.
            Renders its own header + N/N progress strip; no outer label. */}
        <section>
          {showSkeleton ? <TraceSkeleton /> : <ReasoningTrace />}
        </section>
      </div>
    </div>
  );
}
