/**
 * The non-negotiable contract for every Dryline MCP tool.
 *
 * Every tool returns { data, caveats, sources }. The agent skill (and the
 * web app) surface caveats and sources to the user. No claim without a source.
 *
 * If you change this file, update SKILL.md and the web app's renderer in lockstep.
 */

/**
 * A single citation back to a public source.
 * Every claim the agent makes must trace to one of these.
 */
export interface Source {
  /** Human-readable title, e.g. "U.S. Drought Monitor — Hays County, TX". */
  title: string;
  /** Canonical URL that a human can open and verify. */
  url: string;
  /** ISO 8601 timestamp when this data was retrieved. */
  retrievedAt: string;
  /** Optional: the upstream agency or publisher (e.g. "TWDB", "EPA SDWIS"). */
  publisher?: string;
}

export type CaveatSeverity = "info" | "warning" | "error";

/**
 * A structured caveat about the result. NOT a comment field — used by the
 * web app to render data-quality flags and by the skill to constrain claims.
 *
 * Categories the skill cares about:
 * - freshness: "as of YYYY-MM-DD; this source updates weekly"
 * - quality:   "the agency acknowledges 3–6 month reporting lag"
 * - bounds:    "data does NOT include private wells under 25k gpd"
 * - inference: "address resolved with 95% confidence"
 */
export interface Caveat {
  severity: CaveatSeverity;
  message: string;
  /** Optional category tag for UI grouping. */
  category?: "freshness" | "quality" | "bounds" | "inference" | "other";
}

/**
 * The wrapper around every tool's payload.
 *
 * On partial failure (e.g. one upstream API errors), tools should still
 * return ToolResult — set `data` to null and add an error-severity Caveat.
 * NEVER throw across the tool boundary.
 */
export interface ToolResult<T> {
  data: T | null;
  caveats: Caveat[];
  sources: Source[];
}

// ---- Common shared shapes used by multiple tools ----

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ResolvedLocation extends LatLng {
  /** Formatted address as the geocoder returned it. */
  formattedAddress: string;
  /** 5-digit county FIPS code. */
  countyFips: string;
  /** County name without "County" suffix, e.g. "Hays". */
  countyName: string;
  /** State abbreviation; always "TX" for our use case. */
  stateAbbr: "TX";
  /** Watershed HUC-12 code (e.g. "121002030301"). */
  huc12?: string;
  /** Groundwater Conservation District name + slug, if the address is in one. */
  gcd?: { name: string; slug: string };
  /** Public Water System ID (TX-prefixed, EPA-format), if served by one. */
  pwsId?: string;
}

export type DroughtCategory = "None" | "D0" | "D1" | "D2" | "D3" | "D4";

// ---- Tool definition ----

import type { z } from "zod";

/**
 * A registered MCP tool. The registry consumes this shape; the SDK adapter
 * converts to the wire format.
 */
export interface DrylineTool<TInput, TOutput> {
  /** Stable tool name, lowercase_snake. */
  name: string;
  /** One-paragraph description shown to the agent. */
  description: string;
  /** Zod schema for the input arguments. */
  inputSchema: z.ZodType<TInput>;
  /** Run the tool. Must always return a ToolResult — never throw. */
  run: (input: TInput) => Promise<ToolResult<TOutput>>;
}
