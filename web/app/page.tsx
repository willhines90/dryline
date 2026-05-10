/**
 * Dryline — landing / investigation surface.
 *
 * Map is the dominant element. The right panel toggles between the demo-
 * address list (idle state) and the active investigation view (streaming +
 * done states). The cinematic flow:
 *   click Investigate
 *     → map flies to the address
 *     → ReasoningTrace streams tool calls in
 *     → SynthesisCard renders the cited synthesis
 *     → ActionsTab slide handle pulses; user opens it to see the drafted
 *       artifact (public comment / watering reminder / GCD letter / etc.).
 */

"use client";

import * as React from "react";
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
  const { location: active, mode, status } = useInvestigation();
  const focused = active ?? null;
  const headerMode = mode ?? "personal";

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-baseline justify-between bg-background">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Dryline</h1>
          <p className="text-sm text-muted-foreground italic">
            Investigate Texas water at any address.
          </p>
        </div>
        <nav className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
          Mode: {headerMode}
        </nav>
      </header>

      <section className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        <div className="lg:col-span-8 border-b border-border lg:border-b-0">
          <TexasMap locations={locations} focusedLocation={focused} />
        </div>
        <aside className="lg:col-span-4 border-l-0 lg:border-l border-border bg-background flex flex-col">
          {active ? (
            <InvestigationPanel />
          ) : (
            <DemoAddressList locations={locations} />
          )}
        </aside>
      </section>

      <footer className="border-t border-border px-6 py-3 text-xs text-muted-foreground flex justify-between">
        <span>Public Texas water data, cited at the source.</span>
        <span className="italic">The line between you and your water.</span>
      </footer>

      {/* Slide-in artifact panel; renders nothing until artifact arrives. */}
      <ActionsTab />

      {/* Surface stream errors as a non-blocking toast at the bottom. */}
      {status === "error" ? <ErrorToast /> : null}
    </main>
  );
}

function DemoAddressList({ locations }: { locations: DemoLocationWithCoords[] }) {
  // Per-location mode override; defaults to fixture mode.
  const [modeByLoc, setModeByLoc] = React.useState<Record<string, Mode>>({});
  return (
    <div className="p-6 space-y-4 overflow-y-auto">
      <h2 className="font-serif text-lg">Demo addresses</h2>
      <p className="text-xs text-muted-foreground">
        Pre-staged for the live demo. Click <strong>Investigate</strong> to start an autonomous
        run; the reasoning trace streams in real time.
      </p>
      <ul className="space-y-2">
        {locations.map((loc) => {
          const currentMode = modeByLoc[loc.id] ?? loc.mode;
          return (
            <li
              key={loc.id}
              className="text-sm border border-border rounded-md bg-card p-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{loc.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {loc.region}
                    {loc.live ? (
                      <span className="ml-2 rounded-full bg-reservoir-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-reservoir-700">
                        Live
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-foreground/70 mt-2 font-serif italic">
                    {loc.headlineStory}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
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
    <div className="flex-1 flex flex-col overflow-y-auto">
      <header className="px-6 pt-5 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Investigating
            </div>
            <h2 className="font-serif text-lg tracking-tight truncate">{location.label}</h2>
            <div className="text-xs text-muted-foreground mt-0.5 capitalize">
              {mode ?? location.mode} · {location.region}
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
            aria-label="Reset investigation"
          >
            Reset ↺
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
          <span
            className={
              status === "streaming"
                ? "text-reservoir-700"
                : status === "done"
                ? "text-arid-700"
                : status === "error"
                ? "text-red-700"
                : "text-muted-foreground"
            }
          >
            {status === "streaming"
              ? "● Streaming"
              : status === "done"
              ? "○ Done"
              : status === "error"
              ? "✕ Error"
              : "Idle"}
          </span>
          {error ? <span className="text-red-700 normal-case">{error}</span> : null}
        </div>
      </header>

      <div className="px-6 py-4 space-y-5">
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Reasoning trace
          </h3>
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
    <div className="fixed bottom-4 left-4 z-40 max-w-md rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900 shadow-md">
      <div className="font-semibold uppercase tracking-[0.18em] mb-1">Investigation error</div>
      <div className="mb-2 leading-snug">{error}</div>
      <button
        type="button"
        onClick={reset}
        className="text-red-900 underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}
