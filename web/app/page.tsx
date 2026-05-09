/**
 * Dryline — landing / investigation surface.
 *
 * This is a placeholder shell. Codex agents: build the full investigation flow
 * here per /AGENTS.md. The map should be the dominant element; the side panel
 * stacks result cards; the reasoning trace streams in a side rail when an
 * investigation is running. Mode toggle (Personal ↔ Transparency) lives in the
 * top bar.
 *
 * Fixtures: ../fixtures/demo-addresses.json — the canonical seven locations.
 */

import demoAddresses from "../../fixtures/demo-addresses.json";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-baseline justify-between bg-background">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Dryline</h1>
          <p className="text-sm text-muted-foreground italic">
            Investigate Texas water at any address.
          </p>
        </div>
        <nav className="text-sm text-muted-foreground">
          {/* Mode toggle goes here (Codex). */}
        </nav>
      </header>

      <section className="flex-1 grid grid-cols-12 gap-0">
        <div className="col-span-8 bg-reservoir-50 flex items-center justify-center text-reservoir-700">
          {/* MapLibre map mounts here. See AGENTS.md for the cinematic sequence. */}
          <div className="text-center font-serif">
            <p className="text-lg">Map area</p>
            <p className="text-sm text-muted-foreground mt-2">
              MapLibre + topographic basemap goes here.
            </p>
          </div>
        </div>
        <aside className="col-span-4 border-l border-border p-6 space-y-4">
          <h2 className="font-serif text-lg">Demo addresses</h2>
          <p className="text-xs text-muted-foreground">
            Pre-staged for the live demo. Click an address to start an investigation.
          </p>
          <ul className="space-y-2">
            {demoAddresses.locations.map((loc) => (
              <li
                key={loc.id}
                className="text-sm border border-border rounded-md p-3 hover:bg-arid-50 cursor-pointer transition-colors"
              >
                <div className="font-medium">{loc.label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {loc.mode} · {loc.region}
                </div>
                <div className="text-xs text-foreground/70 mt-2 font-serif italic">
                  {loc.headlineStory}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <footer className="border-t border-border px-6 py-3 text-xs text-muted-foreground flex justify-between">
        <span>Public Texas water data, cited at the source.</span>
        <span className="italic">The line between you and your water.</span>
      </footer>
    </main>
  );
}
