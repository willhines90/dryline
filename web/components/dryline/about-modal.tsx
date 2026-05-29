"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Acronym } from "./acronym";

const SOURCES = [
  {
    abbr: "TWDB",
    full: "Texas Water Development Board",
    domain: "waterdatafortexas.org",
    use: "Reservoir levels (37 instrumented majors) + the TWDB Groundwater Database (water-level history at every monitoring well in the state).",
  },
  {
    abbr: "USDM",
    full: "U.S. Drought Monitor",
    domain: "usdmdataservices.unl.edu",
    use: "Weekly drought category by county — None, D0 (abnormal), D1 (moderate), D2 (severe), D3 (extreme), D4 (exceptional).",
  },
  {
    abbr: "USGS",
    full: "U.S. Geological Survey · NWIS",
    domain: "waterservices.usgs.gov",
    use: "Live stream-gauge discharge (cubic feet per second), updated every ~15 minutes per gauge.",
  },
  {
    abbr: "EPA SDWIS",
    full: "EPA Safe Drinking Water Information System",
    domain: "echodata.epa.gov",
    use: "The public water system that serves your address + its current Safe Drinking Water Act compliance (health-based vs procedural violations).",
  },
  {
    abbr: "EPA ECHO CWA",
    full: "EPA Clean Water Act facilities",
    domain: "echodata.epa.gov",
    use: "Federally-reportable NPDES dischargers within radius — both individual permits (with reported flow) and general permits (construction, MSGP).",
  },
  {
    abbr: "Census",
    full: "U.S. Census Bureau · Geocoder",
    domain: "geocoding.geo.census.gov",
    use: "County FIPS code resolution. Used as a fallback when Nominatim doesn't resolve the address cleanly.",
  },
];

interface AboutModalProps {
  open: boolean;
  onClose(): void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-[2px] px-4 py-12 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
    >
      <div
        className={cn(
          "relative w-full max-w-2xl bg-paper border border-ink shadow-paper",
          "animate-dryline-slide",
        )}
      >
        <header className="px-6 pt-5 pb-4 border-b border-rule flex items-baseline justify-between">
          <div>
            <div className="dryline-label">About</div>
            <h2
              id="about-title"
              className="font-serif text-[28px] leading-tight tracking-[-0.012em] mt-1"
            >
              Dryline
            </h2>
            <p className="font-tagline italic text-[14px] text-tideline mt-1">
              Follow the water at any Texas address — every claim cited.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink"
            aria-label="Close"
          >
            Close ✕
          </button>
        </header>

        <div className="px-6 py-5 space-y-5">
          <p className="font-serif text-[17px] leading-relaxed text-ink">
            <strong className="font-semibold">Texas added 2.6 million people in five years — more than any other state. Our water didn&apos;t keep up.</strong>{" "}
            The data is real, public, and federally published — but it&apos;s spread across a stack
            of state and federal agencies, each with a different update cadence, access pattern,
            and freshness profile. By the time a homeowner finds out their groundwater table dropped
            twelve feet last decade, or that a new fab three miles upstream just got a discharge
            permit, the comment window has closed.
          </p>

          <p className="font-serif text-[15.5px] leading-relaxed text-ink/85">
            Type any Texas address. An autonomous flow fans out across drought, reservoirs,
            drinking water, aquifer monitoring, federally-reportable industrial dischargers,
            stream gauges, and active permits. Every fact-bearing sentence cites a public
            source. Every result carries structured caveats explaining what the data does NOT
            say. A single 0–100 <em className="italic">Dryline Score</em> lands at the top of
            the right panel, the cited synthesis below it, and an inline action card surfaces
            a drafted civic-action artifact you can open and edit.
          </p>

          <div>
            <div className="dryline-label mb-2">How to read this surface</div>
            <ul className="grid grid-cols-1 gap-1.5 text-[13.5px] font-serif text-ink/85 leading-snug">
              <li><strong className="font-semibold">The map</strong> shows the current US Drought Monitor polygon under everything, the major TWDB-instrumented reservoirs as drought-colored lake glyphs, USGS stream gauges as ring markers, and seven sample addresses colored by mode (homeowner / watchdog).</li>
              <li><strong className="font-semibold">Click any pin or any sample card</strong> to start an investigation. The map flies to the address and a 15-mile industrial-search radius drops as a translucent disk.</li>
              <li><strong className="font-semibold">The right panel reads top-to-bottom:</strong> Dryline Score → cited synthesis → action card → reasoning trace. The headline answer is on top; the trace is supporting evidence below.</li>
              <li><strong className="font-semibold">The Dryline Score</strong> is reductive on purpose. Hover &ldquo;Why this number?&rdquo; for the per-subscore rationale.</li>
              <li><strong className="font-semibold">The reasoning trace</strong> streams every tool call as it lands. Citation chips link to the actual public source URL with a retrieval timestamp.</li>
              <li><strong className="font-semibold">The drafted artifact</strong> (public comment, GCD letter, watering reminder, etc.) is surfaced inline as an action card with an &ldquo;Open draft&rdquo; button — clicking opens a full editable drawer. There&apos;s no auto-submit. Review before sending.</li>
            </ul>
          </div>

          <div>
            <div className="dryline-label mb-2">Two presentations · same investigation</div>
            <div className="grid grid-cols-2 gap-3 text-[13.5px]">
              <div className="border border-rule bg-card p-3">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-aquifer">
                  Personal
                </div>
                <div className="font-serif italic mt-1 text-ink">Will the water last here?</div>
                <div className="text-tideline mt-2 leading-snug">
                  Lived experience: well owners, utility customers, families. Leads with the
                  local aquifer trend at the nearest TWDB monitoring well. Default artifact:
                  watering reminder or well outlook briefing.
                </div>
              </div>
              <div className="border border-rule bg-card p-3">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ochre-deep">
                  Transparency
                </div>
                <div className="font-serif italic mt-1 text-ink">
                  Who&apos;s drinking your aquifer?
                </div>
                <div className="text-tideline mt-2 leading-snug">
                  Systemic: journalists, civic researchers, residents tracking nearby industry.
                  Leads with a tension flag pairing two facts. Default artifact: public comment,{" "}
                  <Acronym>GCD</Acronym> letter, or <Acronym>PIA</Acronym> request.
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="dryline-label mb-2">What&apos;s investigated</div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12.5px]">
              {SOURCES.map((s) => (
                <li key={s.abbr} className="border border-rule bg-card p-2.5">
                  <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-aquifer">
                    {s.abbr}
                  </div>
                  <div className="font-serif text-[14px] leading-tight mt-0.5">{s.full}</div>
                  <div className="font-mono text-[10px] text-tideline mt-1 truncate" title={s.domain}>
                    {s.domain}
                  </div>
                  <div className="text-tideline mt-1 text-[12px] leading-snug">{s.use}</div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="dryline-label mb-2">Why this works</div>
            <p className="font-serif text-[15px] leading-relaxed text-ink/85">
              Eight bounded <Acronym>MCP</Acronym> tools, each returning <code className="font-mono text-[12.5px] bg-paper-deep px-1">{"{ data, caveats[], sources[] }"}</code>.
              Every claim cites a public URL with a retrievedAt timestamp. The synthesis is
              mode-aware. Civic-action artifacts (public comments, <Acronym>GCD</Acronym> letters, <Acronym>PIA</Acronym>{" "}
              requests) include real <Acronym>NPDES</Acronym> permit IDs — no invented docket
              numbers — and a <em>Review before sending</em> notice. No auto-submit.
            </p>
          </div>

          <div>
            <div className="dryline-label mb-2">Acronyms you might see</div>
            <div className="text-[12.5px] text-tideline leading-snug">
              Hover any underlined abbreviation in the app — <Acronym>TWDB</Acronym>,{" "}
              <Acronym>NPDES</Acronym>, <Acronym>SDWIS</Acronym>, <Acronym>GCD</Acronym>,{" "}
              <Acronym>HUC</Acronym>, <Acronym>FIPS</Acronym>, <Acronym>MGD</Acronym>,{" "}
              <Acronym>CFS</Acronym>, <Acronym>MCL</Acronym> — to see what it stands for.
              The <a href="https://github.com/willhines90/dryline#acronyms" className="text-aquifer underline decoration-dotted underline-offset-2">README&apos;s acronym table</a>{" "}
              has every term in one place.
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-dashed border-rule">
            <ExternalLink href="/methodology">→ Score methodology</ExternalLink>
            <ExternalLink href="https://github.com/willhines90/dryline">→ GitHub</ExternalLink>
            <ExternalLink href="https://github.com/willhines90/dryline/blob/main/skill/SKILL.md">→ Agent skill</ExternalLink>
          </div>

          {/* Author, contact, and privacy — visible trust signals.
              SEO auditors flag pages without an author / contact line. */}
          <div className="pt-4 border-t border-rule space-y-2 text-[12.5px] leading-snug text-tideline">
            <div>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink mr-2">
                Built by
              </span>
              <a
                href="https://github.com/willhines90"
                target="_blank"
                rel="noopener noreferrer"
                className="text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                Will Hines
              </a>
              {" · "}
              <a
                href="mailto:mail@willhin.es"
                className="text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                mail@willhin.es
              </a>
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink mr-2">
                Privacy
              </span>
              Dryline uses Google Analytics 4 for anonymous traffic counts (page
              views, basic events). No accounts, no personal data collected, no
              third-party trackers beyond GA. Address strings you investigate are
              sent to Nominatim (OpenStreetMap) and U.S. Census Geocoder for
              resolution, and to Google&rsquo;s Gemini API for synthesis &mdash;
              no other parties.
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink mr-2">
                License
              </span>
              MIT. Public data is cited; we don&rsquo;t redistribute proprietary
              datasets.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink"
    >
      {children}
    </a>
  );
}
