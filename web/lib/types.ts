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
