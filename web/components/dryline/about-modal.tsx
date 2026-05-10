"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SOURCES = [
  { abbr: "TWDB",        full: "TX Water Development Board",     domain: "waterdatafortexas.org",      use: "Reservoir levels + groundwater wells" },
  { abbr: "USDM",        full: "U.S. Drought Monitor",           domain: "usdmdataservices.unl.edu",    use: "County drought category, weekly" },
  { abbr: "EPA SDWIS",   full: "EPA Safe Drinking Water Info",   domain: "echodata.epa.gov",            use: "Drinking-water compliance via ECHO" },
  { abbr: "EPA ECHO",    full: "EPA Enforcement & Compliance",   domain: "echodata.epa.gov",            use: "Federally-reportable NPDES dischargers" },
  { abbr: "USGS NWIS",   full: "USGS National Water Info",       domain: "waterservices.usgs.gov",      use: "Stream gauges (planned)" },
  { abbr: "Census",      full: "U.S. Census Bureau",             domain: "geocoding.geo.census.gov",    use: "County FIPS resolution" },
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
          <p className="font-serif text-[16px] leading-relaxed text-ink/90">
            Texas water is opaque to the people who depend on it. The data is real, public,
            and federally cited — but it&apos;s spread across eight agencies, ten reporting
            cadences, and a small library of state-only forms with no APIs.{" "}
            <strong className="font-semibold">Dryline collapses that distance.</strong>{" "}
            Type any Texas address. An agent fans out across drought, reservoirs,
            drinking water, aquifer monitoring, and federally-reportable industrial
            dischargers, returning each tool&apos;s result with inline citations and structured
            caveats. A single 0–100{" "}
            <em className="italic">Dryline Score</em> sits at the top; the cited synthesis
            below explains the why; a drafted civic-action artifact slides in from the
            right edge.
          </p>

          <div>
            <div className="dryline-label mb-2">Two presentations · same investigation</div>
            <div className="grid grid-cols-2 gap-3 text-[13.5px]">
              <div className="border border-rule bg-card p-3">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-aquifer">
                  Personal
                </div>
                <div className="font-serif italic mt-1 text-ink">Will the water last here?</div>{/* */}
                <div className="text-tideline mt-2 leading-snug">
                  Lived experience: well owners, utility customers, families. Leads with
                  the local aquifer trend. Default artifact: watering reminder or well
                  outlook briefing.
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
                  Systemic: journalists, civic researchers, residents tracking nearby
                  industry. Leads with a tension flag. Default artifact: public comment,
                  GCD letter, or PIA request.
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
              Six bounded MCP tools, each returning <code className="font-mono text-[12.5px] bg-paper-deep px-1">{"{ data, caveats[], sources[] }"}</code>.
              Every claim cites a public URL with a retrievedAt timestamp. The synthesis is
              mode-aware. Civic-action artifacts (public comments, GCD letters, PIA
              requests) include real NPDES IDs — no invented docket numbers — and a{" "}
              <em>Review before sending</em> notice. No auto-submit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-dashed border-rule mt-2">
            <ExternalLink href="https://github.com/willhines90/dryline">→ GitHub</ExternalLink>
            <ExternalLink href="https://github.com/willhines90/dryline/blob/main/PROPOSAL.md">→ Proposal</ExternalLink>
            <ExternalLink href="https://github.com/willhines90/dryline/blob/main/SUBMISSION.md">→ Submission</ExternalLink>
            <ExternalLink href="https://github.com/willhines90/dryline/blob/main/skill/SKILL.md">→ Agent skill</ExternalLink>
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
