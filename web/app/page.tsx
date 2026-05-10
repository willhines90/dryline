/**
 * Dryline — landing / investigation surface.
 *
 * Layout pulled from the Claude Design bundle: top bar (logo + lede +
 * search + mode toggle), 62/38 split (map left, panel right), status
 * footer pinned at the bottom. The cinematic flow:
 *
 *   click Investigate (or pick a search result)
 *     → map flies to the address
 *     → ReasoningTrace streams tool calls in
 *     → SynthesisCard renders the cited synthesis
 *     → ActionsTab slide handle pulses; user opens it for the artifact
 *       (public comment / watering reminder / GCD letter / etc.).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import demoAddresses from "../../fixtures/demo-addresses.json";
import { TexasMap } from "@/components/texas-map";
import {
  InvestigationProvider,
  useInvestigation,
} from "@/components/dryline/investigation-provider";
import { InvestigateButton, ModeToggle } from "@/components/dryline/investigate-button";
import { ReasoningTrace } from "@/components/dryline/reasoning-trace";
import { SynthesisCard } from "@/components/dryline/synthesis-card";
import { ActionsTab } from "@/components/dryline/actions-tab";
import { DrylineLogo } from "@/components/dryline/dryline-logo";
import { SearchBar } from "@/components/dryline/search-bar";
import { StatusFooter } from "@/components/dryline/status-footer";
import type { DemoLocationWithCoords, Mode } from "@/lib/types";

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
  const { location: active, mode, status, start } = useInvestigation();
  const focused = active ?? null;
  const [globalMode, setGlobalMode] = React.useState<Mode>("personal");
  const headerMode = mode ?? globalMode;

  // SearchBar pick → fire investigation directly.
  const handleSearchPick = React.useCallback(
    (loc: DemoLocationWithCoords) => start(loc, loc.mode ?? globalMode),
    [start, globalMode],
  );

  return (
    <main className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-30 border-b border-rule bg-background/90 backdrop-blur-sm">
        <div className="px-6 py-3 flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-4 min-w-0">
            <Link href="/" className="flex items-center gap-2 no-underline group">
              <DrylineLogo size={20} />
              <span className="font-serif text-[22px] font-semibold tracking-[-0.012em] text-ink">
                Dryline
              </span>
            </Link>
            <span className="hidden md:inline font-serif italic text-[14px] text-tideline truncate">
              Investigate Texas water at any address.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar
              staged={locations}
              onPick={handleSearchPick}
              activeLabel={active?.label ?? null}
            />
            <ModeToggle value={headerMode} onChange={setGlobalMode} />
          </div>
        </div>
      </header>

      <section className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0">
        <div className="lg:col-span-8 min-w-0 border-b border-rule lg:border-b-0 relative">
          <TexasMap locations={locations} focusedLocation={focused} />
        </div>
        <aside className="lg:col-span-4 min-w-0 border-l-0 lg:border-l border-rule bg-background flex flex-col overflow-hidden">
          {active ? (
            <InvestigationPanel />
          ) : (
            <DemoAddressList locations={locations} globalMode={globalMode} />
          )}
        </aside>
      </section>

      <StatusFooter />

      {/* Slide-in artifact panel; renders nothing until artifact arrives. */}
      <ActionsTab />

      {status === "error" ? <ErrorToast /> : null}
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
  const [modeByLoc, setModeByLoc] = React.useState<Record<string, Mode>>({});

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
      <div>
        <div className="dryline-label">Demo addresses</div>
        <h2 className="font-serif text-[26px] leading-tight tracking-[-0.008em] mt-1">
          Pick an address to investigate.
        </h2>
        <p className="font-serif italic text-tideline text-[15px] mt-2">
          Pre-staged for the live demo. Investigation streams in real time — every claim cites a public source.
        </p>
      </div>

      <ul className="space-y-3">
        {locations.map((loc) => {
          const currentMode = modeByLoc[loc.id] ?? loc.mode ?? globalMode;
          return (
            <li
              key={loc.id}
              className="border border-rule bg-card p-4 transition-colors hover:border-ink/30"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="dryline-label">{loc.region}</div>
                {loc.live ? (
                  <span className="font-mono text-[8.5px] tracking-[0.18em] text-ink border border-ink px-1.5 py-px">
                    LIVE
                  </span>
                ) : (
                  <span className="font-mono text-[8.5px] tracking-[0.18em] text-tideline border border-rule px-1.5 py-px">
                    CHAMBER
                  </span>
                )}
              </div>

              <div className="font-serif text-[19px] leading-tight tracking-[-0.008em] mt-1.5 text-ink">
                {loc.label}
              </div>

              <p className="font-serif italic text-[13.5px] text-tideline mt-2 leading-snug">
                {loc.headlineStory}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <InvestigateButton location={loc} mode={currentMode} />
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

function InvestigationPanel() {
  const { location, mode, status, reset, error } = useInvestigation();
  if (!location) return null;
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
      <header className="px-6 pt-5 pb-4 border-b border-rule">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="dryline-label">Investigating</div>
            <h2 className="font-serif text-[26px] leading-[1.1] tracking-[-0.008em] mt-1 truncate text-ink">
              {location.label}
            </h2>
            <div className="font-serif italic text-[14.5px] text-tideline mt-1">
              {(mode ?? "personal") === "personal"
                ? "Will the water last here?"
                : "Who's drinking your aquifer?"}
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink border border-rule px-2.5 py-1.5 transition-colors"
            aria-label="Reset investigation"
          >
            Reset ↺
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] uppercase">
          <span
            className={
              status === "streaming"
                ? "text-aquifer flex items-center gap-1.5"
                : status === "done"
                ? "text-kelp flex items-center gap-1.5"
                : status === "error"
                ? "text-rust flex items-center gap-1.5"
                : "text-tideline flex items-center gap-1.5"
            }
          >
            <span
              aria-hidden
              className={`w-1.5 h-1.5 rounded-full ${
                status === "streaming"
                  ? "bg-aquifer animate-dryline-pulse"
                  : status === "done"
                  ? "bg-kelp"
                  : status === "error"
                  ? "bg-rust"
                  : "bg-tideline"
              }`}
            />
            {status === "streaming"
              ? "Streaming"
              : status === "done"
              ? "Done"
              : status === "error"
              ? "Error"
              : "Idle"}
          </span>
          {error ? <span className="text-rust normal-case tracking-normal">{error}</span> : null}
        </div>
      </header>

      <div className="px-6 py-4 space-y-5">
        <section>
          <div className="dryline-label mb-2">Reasoning trace</div>
          <ReasoningTrace />
        </section>
        <section>
          <SynthesisCard />
        </section>
      </div>
    </div>
  );
}

function ErrorToast() {
  const { error, reset } = useInvestigation();
  if (!error) return null;
  return (
    <div className="fixed bottom-12 left-4 z-40 max-w-md border border-rust bg-background px-4 py-3 text-xs text-ink shadow-paper">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-rust mb-1">
        Investigation error
      </div>
      <div className="mb-2 leading-snug font-serif">{error}</div>
      <button
        type="button"
        onClick={reset}
        className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}
