/**
 * Wire types — kept in sync with @dryline/mcp/src/types.ts.
 *
 * The web app does not import from the MCP package directly; instead it
 * mirrors the contract here. This keeps the boundary clean: if the MCP
 * server ever moves to a different runtime (Python, Rust), the web app
 * doesn't need to know.
 *
 * Update both files together.
 */

export type CaveatSeverity = "info" | "warning" | "error";

export interface Source {
  title: string;
  url: string;
  retrievedAt: string;
  publisher?: string;
}

export interface Caveat {
  severity: CaveatSeverity;
  message: string;
  category?: "freshness" | "quality" | "bounds" | "inference" | "other";
}

export interface ToolResult<T> {
  data: T | null;
  caveats: Caveat[];
  sources: Source[];
}

export type Mode = "personal" | "transparency";

export interface DemoLocation {
  id: string;
  label: string;
  city: string;
  county: string;
  region: string;
  mode: Mode;
  headlineStory: string;
}

export interface DemoLocationWithCoords extends DemoLocation {
  approxLatLng?: { lat: number; lng: number };
  live?: boolean;
  /** Optional human-scale framing line for live-trio fixtures; required to land in the synthesis. */
  humanScaleHook?: string;
}

// ---- Investigation flow (Phase 3) ----

export type ToolStartEvent = {
  type: "tool_start";
  toolName: string;
  args: unknown;
};

export type ToolResultEvent = {
  type: "tool_result";
  toolName: string;
  summary: string;
  data: unknown;
  sources: Source[];
  caveats: Caveat[];
};

export type TraceEvent = ToolStartEvent | ToolResultEvent;

export type ArtifactKind =
  | "public_comment"
  | "watering_reminder"
  | "gcd_letter"
  | "well_outlook_briefing"
  | "pia_request"
  | "weekly_briefing";

export interface ArtifactPayload {
  kind: ArtifactKind | string;
  title: string;
  markdown: string;
}

export interface SynthesisPayload {
  markdown: string;
  sources: Source[];
}

export type InvestigationStatus = "idle" | "streaming" | "done" | "error";
