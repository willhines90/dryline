# @dryline/mcp

The Model Context Protocol server for Dryline. Exposes 9 bounded tools that fetch and summarize Texas water data, all returning a strict `{ data, caveats[], sources[] }` shape.

> Read `../CLAUDE.md` and `../PROPOSAL.md` before making non-trivial changes here.

## Tools (priority order)

1. `resolve_location` — geocode + county FIPS (+ HUC-12, GCD, PWS as snapshots come online)
2. `get_drought_status` — U.S. Drought Monitor REST
3. `get_reservoirs` — TWDB Water Data for Texas
4. `get_drinking_water` — EPA SDWIS via ECHO
5. `get_big_users_nearby` — EPA ECHO regulated facilities
6. `get_aquifer_status` — TWDB GWDB snapshot
7. `get_active_permits` — TCEQ via ECHO + curated snapshot
8. `get_river_flow` — USGS NWIS (discharge)
9. `get_water_quality` — USGS NWIS in-situ sensors (specific conductance, nitrate, DO, pH, temp, turbidity)

Tools 1–5 form the **minimum viable winning version**. Build them end-to-end first.

## The contract — every tool returns this

```ts
type ToolResult<T> = {
  data: T | null;
  caveats: Caveat[];   // freshness, quality, bounds, inference
  sources: Source[];   // {title, url, retrievedAt, publisher}
};
```

- Tools never throw across the boundary. On failure: `data: null` + an error-severity Caveat.
- Every result cites every source, with a `retrievedAt` ISO timestamp.
- `caveats` is structured (not a comment field) so the web app can render it and the skill can constrain claims.

## Running

```bash
pnpm install
pnpm dev          # tsx watch — speaks MCP over stdio
pnpm build        # tsc → dist/
pnpm typecheck
```

To wire into Codex CLI / Claude Code locally:

```bash
# Codex example
codex mcp add dryline-mcp --command="node $(pwd)/dist/index.js"

# Claude Code example (drop into ~/.claude.json or per-project mcp config)
{
  "mcpServers": {
    "dryline": { "command": "node", "args": ["./dryline/mcp/dist/index.js"] }
  }
}
```

## Snapshots

Some sources don't have queryable APIs (TWDB GWDB, TNRIS floodplain, TNRIS parcels). They get loaded into DuckDB at server start. Fetch scripts will live under `scripts/snapshots/` (TODO).

Snapshot files go to `./data/snapshots/` (gitignored). The DuckDB file goes to `./data/dryline.duckdb` (gitignored).

### DuckDB is an optional dependency

`duckdb-async` is listed under `optionalDependencies` because the native-binding install can be slow or fail in sandboxed environments. The MCP server boots without it; snapshot-backed tools (6–8) surface a warning Caveat when DuckDB is unavailable. The minimum viable winning version (tools 1–5) hits live APIs only and does not need DuckDB.

To force-skip the install: `pnpm install --no-optional`.
To install it later: `pnpm add duckdb-async --filter @dryline/mcp`.
