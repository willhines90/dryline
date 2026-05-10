"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * In-app acronym hover/expansion. Wraps an `<abbr>` tag with subtle
 * dotted underline styling so a first-time viewer can hover any
 * known abbreviation (TWDB, EPA, NPDES, etc.) and see what it stands
 * for — without us writing out the full name in every paragraph.
 */

const GLOSSARY: Record<string, string> = {
  TWDB: "Texas Water Development Board — the state agency that funds and tracks water-supply data, reservoirs, and the groundwater database.",
  USDM: "U.S. Drought Monitor — weekly federal classification of drought severity, county-level. None / D0 / D1 / D2 / D3 / D4.",
  USGS: "U.S. Geological Survey — federal earth-science agency; runs the NWIS stream-gauge network we read for live discharge.",
  NWIS: "USGS National Water Information System — public REST service for stream gauges, water-quality stations, and groundwater wells.",
  EPA: "U.S. Environmental Protection Agency — federal regulator; we draw on EPA's ECHO and SDWIS systems.",
  ECHO: "EPA Enforcement and Compliance History Online — public API surface for federally-reportable permits, facilities, and enforcement.",
  SDWIS: "EPA Safe Drinking Water Information System — federal database of public water systems and their compliance with the Safe Drinking Water Act.",
  CWA: "Clean Water Act — the federal law that governs surface-water discharge, NPDES permits, and effluent standards.",
  NPDES: "National Pollutant Discharge Elimination System — the federal permit program for any pollutant entering U.S. surface waters.",
  TCEQ: "Texas Commission on Environmental Quality — the Texas state environmental regulator. Where most state-only permits live.",
  PWS: "Public Water System — a utility regulated under the Safe Drinking Water Act (community, transient non-community, etc.).",
  PWSID: "Public Water System ID — the federal identifier for a PWS, e.g. TX1050018 = Wimberley Water Supply Corporation.",
  GCD: "Groundwater Conservation District — a Texas local-government unit (created county-by-county) that regulates groundwater pumping.",
  GWDB: "TWDB Groundwater Database — the nightly-refreshed pipe-delimited dump of well metadata and historical water-level readings.",
  HUC: "Hydrologic Unit Code — USGS hierarchical watershed identifier (HUC-2 down to HUC-12).",
  FIPS: "Federal Information Processing Standards code — five-digit county identifier (e.g. 48209 = Hays County, TX).",
  MGD: "Million gallons per day — the standard unit for permitted discharge or supply volume.",
  CFS: "Cubic feet per second — the standard unit for stream discharge.",
  MCL: "Maximum Contaminant Level — the highest legally allowable concentration of a contaminant in drinking water under SDWA.",
  MRDL: "Maximum Residual Disinfectant Level — like an MCL, but for the disinfectant itself (chlorine, chloramine).",
  TT: "Treatment Technique — a Safe Drinking Water Act compliance category for procedures (vs concentration limits) a utility must follow.",
  PIA: "Public Information Act — the Texas open-records law (Government Code Chapter 552) that lets anyone request agency records.",
  WCID: "Water Control and Improvement District — a Texas local-government unit that supplies water and/or wastewater service.",
  DMR: "Discharge Monitoring Report — an EPA-required self-report by NPDES permittees describing what they discharged.",
  DFR: "Detailed Facility Report — EPA ECHO's per-facility public dashboard at echo.epa.gov/detailed-facility-report.",
  MCP: "Model Context Protocol — Anthropic's open standard for letting AI agents call external tools and resources over a uniform interface.",
  SSE: "Server-Sent Events — a one-way streaming protocol over plain HTTP; how Dryline streams reasoning trace events to the browser.",
  RFP: "Request for Public Comment — the formal window during which an agency invites comment on a proposed permit.",
};

/** Look up an acronym; returns undefined if not in the glossary. */
export function expandAcronym(short: string): string | undefined {
  return GLOSSARY[short];
}

/** All glossary entries, useful for a README/About glossary table. */
export function listAcronyms(): Array<{ short: string; long: string }> {
  return Object.entries(GLOSSARY).map(([short, long]) => ({ short, long }));
}

interface AcronymProps {
  /** The short form, e.g. "TWDB". Must be a key in the glossary. */
  children: string;
  /** Override the glossary lookup with a custom expansion. */
  title?: string;
  className?: string;
}

export function Acronym({ children, title, className }: AcronymProps) {
  const expansion = title ?? expandAcronym(children);
  if (!expansion) return <>{children}</>;
  return (
    <abbr
      title={expansion}
      className={cn(
        "no-underline border-b border-dotted border-tideline/60 cursor-help",
        className,
      )}
    >
      {children}
    </abbr>
  );
}
