/**
 * Dryline — landing / investigation surface.
 *
 * Strict viewport-locked layout: header + (map | panel) + footer = exactly
 * 100vh. Page never scrolls; the right panel handles its own internal
 * scroll. Map stays visible at all times.
 *
 * Compare-mode: the right panel splits into two stacked InvestigationPanel
 * instances — primary on top, secondary below, ComparisonHero strip
 * above both once both scores arrive.
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
  type Slot,
} from "@/components/dryline/investigation-provider";
import { InvestigateButton, ModeToggle } from "@/components/dryline/investigate-button";
import { ReasoningTrace } from "@/components/dryline/reasoning-trace";
import { SynthesisCard } from "@/components/dryline/synthesis-card";
import { ActionsTab, ActionCard } from "@/components/dryline/actions-tab";
import { DrylineLogo, type LogoVariant } from "@/components/dryline/dryline-logo";
import { DrylineScore } from "@/components/dryline/dryline-score";
import { SearchBar } from "@/components/dryline/search-bar";
import { ComparisonHero } from "@/components/dryline/comparison-hero";
import { AboutModal } from "@/components/dryline/about-modal";
import { TraceSkeleton } from "@/components/dryline/trace-skeleton";
import { DarkModeProvider } from "@/components/dryline/dark-mode-toggle";
import { ViewMenu } from "@/components/dryline/view-menu";
import type { DemoLocationWithCoords, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/willhines90/dryline";

export default function HomePage() {
  const locations = (demoAddresses.locations as DemoLocationWithCoords[]).filter(
    (l) => l.approxLatLng,
  );
  return (
    <DarkModeProvider>
      <InvestigationProvider>
        <PageShell locations={locations} />
      </InvestigationProvider>
    </DarkModeProvider>
  );
}

function PageShell({ locations }: { locations: DemoLocationWithCoords[] }) {
  const { primary, secondary, compareMode, startNextAvailable } = useMultiInvestigation();
  const focused = primary.location ?? secondary.location ?? null;
  const investigationActive =
    primary.status === "streaming" || secondary.status === "streaming";
  const [globalMode, setGlobalMode] = React.useState<Mode>("personal");
  const [aboutOpen, setAboutOpen] = React.useState(false);
  // Logo picker — temporary. Read ?logo= from the URL once on mount so we
  // can A/B in the live header without rebuilding. Delete once a variant
  // is chosen and hard-coded.
  const [logoVariant, setLogoVariant] = React.useState<LogoVariant>("scallop");
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const v = new URLSearchParams(window.location.search).get("logo");
    if (v === "scallop" || v === "aquifer" || v === "confluence" || v === "radial" || v === "current") {
      setLogoVariant(v);
    }
  }, []);

  const handlePick = React.useCallback(
    (loc: DemoLocationWithCoords) => startNextAvailable(loc, loc.mode ?? globalMode),
    [startNextAvailable, globalMode],
  );

  const anyActive = primary.location || secondary.location;

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="shrink-0 relative z-40 border-b border-rule bg-background/90 backdrop-blur-sm" style={{ isolation: "isolate" }}>
        <div className="px-4 py-2.5 flex items-center gap-3 min-w-0">
          {/* Brand block — collapses tagline first as width shrinks. */}
          <Link href="/" className="flex items-center gap-2 no-underline shrink-0" aria-label="Dryline — home">
            <DrylineLogo size={22} variant={logoVariant} />
            <span className="font-serif text-[20px] font-semibold tracking-[-0.012em] text-ink">
              Dryline
            </span>
          </Link>
          <span className="hidden xl:inline font-serif italic text-[13px] text-tideline truncate min-w-0 max-w-[260px]">
            Investigate Texas water at any address.
          </span>
          {/* Search takes the available middle space; everything else is shrink-0. */}
          <div className="flex-1 min-w-0 flex justify-center px-2">
            <SearchBar
              staged={locations}
              onPick={handlePick}
              activeLabel={primary.location?.label ?? null}
              className="w-full max-w-[420px]"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ModeToggle value={globalMode} onChange={setGlobalMode} />
            <ViewMenu />
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              title="What Dryline is, what each mode means, and where the data comes from."
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink border border-rule px-2.5 py-1.5 transition-colors"
            >
              About
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-7 h-7 border border-rule text-tideline hover:text-ink hover:border-ink/40 transition-colors"
              title="View source on GitHub"
              aria-label="View source on GitHub"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <section className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0">
        <div className="lg:col-span-8 min-w-0 min-h-0 border-b border-rule lg:border-b-0 relative">
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
        <aside className="lg:col-span-4 min-w-0 min-h-0 border-l-0 lg:border-l border-rule bg-background flex flex-col overflow-hidden">
          {!anyActive ? (
            <DemoAddressList locations={locations} globalMode={globalMode} />
          ) : (
            <CompareOrSinglePanels />
          )}
        </aside>
      </section>

      <ActionsTab />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}

function CompareOrSinglePanels() {
  const { compareMode, primary, secondary } = useMultiInvestigation();

  if (!compareMode) {
    return (
      <SlotCtx.Provider value="primary">
        <InvestigationPanel />
      </SlotCtx.Provider>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {primary.score && secondary.score ? (
        <div className="px-5 pt-4">
          <ComparisonHero />
        </div>
      ) : null}
      <div className="divide-y divide-rule">
        <SlotCtx.Provider value="primary">
          <CompareSlotPanel slot="primary" />
        </SlotCtx.Provider>
        <SlotCtx.Provider value="secondary">
          <CompareSlotPanel slot="secondary" />
        </SlotCtx.Provider>
      </div>
    </div>
  );
}

function CompareSlotPanel({ slot }: { slot: Slot }) {
  const slotApi = useInvestigation();
  if (!slotApi.location) return <SlotPlaceholder slot={slot} />;
  return <InvestigationPanel compact slotLabel={slot} />;
}

function SlotPlaceholder({ slot }: { slot: Slot }) {
  return (
    <div className="px-5 py-5">
      <div className="dryline-label">{slot === "primary" ? "Primary" : "Secondary"}</div>
      <p className="font-serif italic text-tideline text-[13.5px] mt-2">
        {slot === "secondary"
          ? "Pick a second address from the map or search to compare."
          : "Pick a primary address to start the comparison."}
      </p>
    </div>
  );
}

function DemoAddressList({
  locations,
  globalMode,
}: {
  locations: DemoLocationWithCoords[];
  globalMode: Mode;
}) {
  const { compareMode, primary, secondary, startNextAvailable } = useMultiInvestigation();
  const [modeByLoc, setModeByLoc] = React.useState<Record<string, Mode>>({});

  const nextSlotHint: Slot | null = !compareMode
    ? null
    : !primary.location
    ? "primary"
    : !secondary.location
    ? "secondary"
    : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
      <div>
        <div className="dryline-label">Demo addresses</div>
        <h2 className="font-serif text-[22px] leading-tight tracking-[-0.008em] mt-0.5">
          {compareMode ? "Pick two addresses to compare." : "Pick an address to investigate."}
        </h2>
        <p className="font-serif italic text-tideline text-[13.5px] mt-1.5 leading-snug">
          {compareMode
            ? "Two parallel investigations, scored side by side. The contrast is the demo."
            : "Pre-staged for the live demo. Every claim cites a public source."}
        </p>
      </div>

      <ul className="space-y-2.5">
        {locations.map((loc) => {
          const currentMode = modeByLoc[loc.id] ?? loc.mode ?? globalMode;
          return (
            <li
              key={loc.id}
              className="border border-rule bg-card px-3.5 py-3 transition-colors hover:border-ink/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="dryline-label truncate">{loc.region}</div>
              </div>

              <div className="font-serif text-[16px] leading-tight tracking-[-0.008em] mt-1 text-ink">
                {loc.label}
              </div>

              <p className="font-serif italic text-[12.5px] text-tideline mt-1.5 leading-snug">
                {loc.headlineStory}
              </p>

              <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                {compareMode ? (
                  <button
                    type="button"
                    onClick={() => startNextAvailable(loc, currentMode)}
                    disabled={nextSlotHint === null}
                    title={
                      nextSlotHint === null
                        ? "Both compare slots are full. Reset one (or toggle Compare off) to investigate a new address."
                        : `Drop into the ${nextSlotHint} slot.`
                    }
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 border bg-ink text-paper border-ink",
                      "font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                      "hover:bg-aquifer hover:border-aquifer disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {nextSlotHint === "secondary"
                      ? "→ Secondary"
                      : nextSlotHint === "primary"
                      ? "→ Primary"
                      : "Both filled · reset to swap"}
                  </button>
                ) : (
                  <InvestigateButton location={loc} mode={currentMode} />
                )}
                <ModeToggle
                  value={currentMode}
                  onChange={(m) => setModeByLoc((s) => ({ ...s, [loc.id]: m }))}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface InvestigationPanelProps {
  compact?: boolean;
  slotLabel?: Slot;
}

function InvestigationPanel({ compact, slotLabel }: InvestigationPanelProps) {
  const { location, mode, status, reset, error, score, traces, start } = useInvestigation();
  if (!location) return null;
  const showSkeleton = status === "streaming" && traces.length === 0;
  return (
    <div className={cn("flex flex-col", compact ? "" : "flex-1 min-h-0 overflow-y-auto")}>
      <header className="px-5 pt-4 pb-3 border-b border-rule">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="dryline-label">
              {slotLabel
                ? `${slotLabel === "primary" ? "Primary" : "Secondary"} · investigating`
                : "Investigating"}
            </div>
            <h2 className="font-serif text-[20px] leading-[1.1] tracking-[-0.008em] mt-0.5 truncate text-ink">
              {location.label}
            </h2>
            <div className="font-serif italic text-[13px] text-tideline mt-1">
              {(mode ?? "personal") === "personal"
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
