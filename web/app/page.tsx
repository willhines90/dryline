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
import { InvestigateButton, ModeToggle } from "@/components/dryline/investigate-button";
import { ReasoningTrace } from "@/components/dryline/reasoning-trace";
import { SynthesisCard } from "@/components/dryline/synthesis-card";
import { ActionsTab, ActionCard } from "@/components/dryline/actions-tab";
import { DrylineLogo, type LogoVariant } from "@/components/dryline/dryline-logo";
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
  // Mode is no longer a global header concern. It defaults to whatever
  // the demo address declares (or "personal" for free-text searches);
  // users flip the lens inside the active investigation panel.
  const globalMode: Mode = "personal";
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

  const anyActive = primary.location;

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background">
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
        <div className="px-4 py-3 flex items-center gap-3 min-w-0">
          {/* Brand block — collapses tagline first as width shrinks. */}
          <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0 group" aria-label="Dryline — home">
            <DrylineLogo size={30} variant="front" />
            <span
              className="text-[26px] tracking-[-0.018em] text-ink leading-none"
              style={{ fontFamily: "var(--font-fraunces), 'Newsreader', Georgia, serif", fontWeight: 700, fontVariationSettings: "'opsz' 96" }}
            >
              Dryline
            </span>
          </Link>
          <span
            aria-hidden
            className="hidden xl:inline-block h-5 w-px bg-ink/15 shrink-0"
          />
          <span className="hidden xl:inline font-serif italic text-[13.5px] text-tideline truncate min-w-0 max-w-[320px]">
            Where Texas weather meets Texas water — at any address.
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
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              title="What Dryline is and where the data comes from."
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
            <SlotCtx.Provider value="primary">
              <InvestigationPanel />
            </SlotCtx.Provider>
          )}
        </aside>
      </section>

      <ActionsTab />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}

function DemoAddressList({
  locations,
  globalMode,
}: {
  locations: DemoLocationWithCoords[];
  globalMode: Mode;
}) {
  const { startNextAvailable } = useMultiInvestigation();
  const pick = (loc: DemoLocationWithCoords) =>
    startNextAvailable(loc, loc.mode ?? globalMode);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5">
      <div>
        <div className="dryline-label">Try one</div>
        <h2 className="font-serif text-[20px] leading-tight tracking-[-0.008em] mt-0.5">
          Sample addresses
        </h2>
        <p className="font-serif italic text-tideline text-[12.5px] mt-1 leading-snug">
          Click any card to investigate. Or type an address up top.
        </p>
      </div>

      <ul className="space-y-2">
        {locations.map((loc) => {
          const m: Mode = loc.mode ?? "personal";
          return (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => pick(loc)}
                className={cn(
                  "group block w-full text-left border border-rule bg-card px-3 py-2.5",
                  "transition-colors hover:border-ink/40 hover:bg-paper-deep",
                  "focus:outline-none focus:border-ink",
                )}
                aria-label={`Investigate ${loc.label}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="dryline-label truncate">{loc.region}</span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[8.5px] tracking-[0.16em] uppercase px-1.5 py-px border",
                      m === "personal"
                        ? "text-aquifer border-aquifer/60"
                        : "text-ochre-deep border-ochre-deep/60",
                    )}
                  >
                    {m === "personal" ? "Homeowner" : "Watchdog"}
                  </span>
                </div>
                <div className="font-serif text-[15px] leading-tight tracking-[-0.008em] mt-0.5 text-ink">
                  {loc.label}
                </div>
                <p className="font-serif italic text-[12px] text-tideline mt-1 leading-snug line-clamp-2">
                  {loc.headlineStory}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
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
