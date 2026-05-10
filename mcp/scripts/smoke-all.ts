/**
 * Smoke-test every published MVP tool against a Wimberley-class fixture.
 * Exits non-zero if any tool returns data: null or has zero sources.
 *
 * Run from repo root:
 *   pnpm --filter @dryline/mcp exec tsx scripts/smoke-all.ts
 */

import { tools as drylineTools } from "../src/tools/index.js";
import type { ToolResult } from "../src/types.js";

interface Case {
  name: string;
  args: Record<string, unknown>;
}

const CASES: Case[] = [
  { name: "resolve_location", args: { address: "Wimberley, Hays, TX" } },
  { name: "get_drought_status", args: { countyFips: "48209" } },
  { name: "get_reservoirs", args: { lat: 29.997, lng: -98.099, radiusMi: 50 } },
  { name: "get_drinking_water", args: { pwsId: "TX1050018" } },
  { name: "get_big_users_nearby", args: { lat: 29.997, lng: -98.099, radiusMi: 15 } },
  { name: "get_aquifer_status", args: { lat: 29.997, lng: -98.099, radiusMi: 20 } },
  { name: "get_river_flow", args: { lat: 29.997, lng: -98.099, radiusMi: 25 } },
  { name: "get_active_permits", args: { lat: 29.997, lng: -98.099, radiusMi: 15 } },
];

async function run(c: Case) {
  const tool = drylineTools.find((t) => t.name === c.name);
  if (!tool) {
    return { name: c.name, status: "MISSING", caveats: 0, sources: 0 };
  }
  const parsed = tool.inputSchema.safeParse(c.args);
  if (!parsed.success) {
    return { name: c.name, status: `INVALID_ARGS: ${parsed.error.message}`, caveats: 0, sources: 0 };
  }
  const result = (await tool.run(parsed.data)) as ToolResult<unknown>;
  const ok = result.data !== null && result.sources.length > 0;
  return {
    name: c.name,
    status: ok ? "PASS" : "FAIL",
    caveats: result.caveats.length,
    sources: result.sources.length,
    note: ok ? "" : (result.caveats.find((cav) => cav.severity === "error")?.message ?? ""),
  };
}

async function main() {
  const results = await Promise.all(CASES.map(run));
  const colWidth = Math.max(...CASES.map((c) => c.name.length));
  for (const r of results) {
    console.log(
      `  ${r.status.padEnd(6)} ${r.name.padEnd(colWidth)}  caveats=${r.caveats} sources=${r.sources}${r.note ? ` :: ${r.note}` : ""}`,
    );
  }
  const failed = results.filter((r) => r.status !== "PASS");
  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${results.length} tools failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} MVP tools green.`);
}

main().catch((err) => {
  console.error("smoke-all fatal:", err);
  process.exit(1);
});
