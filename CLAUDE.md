# Dryline — Claude Code agent brief

You are working on **Dryline**, a Texas water environmental-intelligence tool built for the AITX × Codex Hackathon (May 9–10, 2026). This file is your project briefing. Read [`PROPOSAL.md`](../PROPOSAL.md) before any non-trivial change — it's the source of truth for scope, demo flow, and what to avoid.

## Your beat in this repo

Claude Code owns **`/mcp`** and **`/skill`**. Specifically:

- The MCP server: 8 bounded tools, all returning `{ data, caveats[], sources[] }`
- DuckDB snapshot loader for groundwater wells, parcels, floodplain
- The agent skill (`/skill/SKILL.md`) that teaches *any* agent (Codex, Claude, custom OpenAI loop) how to use the MCP responsibly
- Worked examples and reference docs in `/skill/references/`

Codex owns `/web`. Don't edit it without coordinating — your job is to make the MCP contract great so the web app can render it cleanly.

## The non-negotiable contract

Every MCP tool returns:

```ts
type ToolResult<T> = {
  data: T;
  caveats: Caveat[];   // freshness, confidence, what the data does NOT say
  sources: Source[];   // {title, url, retrievedAt}
};
```

`caveats` is *not* a comment field. It's the structured channel for:

- Data freshness (e.g., "USDM as of 2026-05-06; updated weekly")
- Known data quality issues (e.g., "TCEQ violations underreport; EPA acknowledges 3-6 month lag")
- What the data does NOT say (e.g., "presence of permit ≠ environmental harm")
- Confidence (e.g., "address resolution succeeded with 95% match")

`sources` is *every* upstream URL with a `retrievedAt` timestamp. The web app surfaces these. No claim without a source.

## The eight tools (priority order)

1. **`resolve_location(address)`** — lat/lng + county + watershed (HUC-12) + GCD + PWS ID. Foundation for everything else.
2. **`get_drought_status(address)`** — U.S. Drought Monitor REST API.
3. **`get_reservoirs(address, radius_mi)`** — TWDB Water Data for Texas REST.
4. **`get_drinking_water(pws_or_address)`** — EPA SDWIS via ECHO REST API.
5. **`get_big_users_nearby(address, radius_mi)`** — EPA ECHO regulated facilities (TCEQ proxy).
6. **`get_aquifer_status(address)`** — TWDB GWDB snapshot in DuckDB.
7. **`get_active_permits(address, radius_mi, since)`** — TCEQ permit data, ECHO proxy where available.
8. **`get_river_flow(address)`** — USGS NWIS REST API.

Tools 1–5 are the **minimum viable winning version** (see PROPOSAL.md fallback section). Build them first, end-to-end, with real source URLs and live API calls where the data is live. Tools 6–8 ship if time allows.

## Conventions

- **TypeScript ESM everywhere.** Strict mode (`tsconfig.base.json`).
- **MCP TS SDK** (`@modelcontextprotocol/sdk`) — current API uses `Server` from `sdk/server/index.js` and `StdioServerTransport`.
- **Each tool in its own file** under `mcp/src/tools/`. Export a default `Tool<I, O>` instance. The registry (`mcp/src/tools/index.ts`) wires them up.
- **No throwing across the tool boundary.** If a fetch fails, return `{ data: null, caveats: [{ severity: 'error', message }], sources: [] }`. The agent must be able to reason about partial failure.
- **Cite source URL with retrievedAt timestamp on every result.** No exceptions.
- **DuckDB for snapshots only.** Live APIs don't pass through DuckDB.

## Skill discipline (`/skill/SKILL.md`)

The skill teaches an agent how to USE the tools, not what they return. It must include:

- When to invoke which tool (decision rubric mapping question types to tool sequences)
- How to combine results without overclaiming (correlation ≠ causation; permitted ≠ polluting)
- Citation discipline: every sentence in the synthesis links to a source
- Action-drafting rules: when to draft a public comment vs GCD letter vs briefing
- Three worked examples with full reasoning traces (one personal-mode, two transparency-mode)
- Required disclaimers (this does not constitute legal/health advice)

Resist scope creep on examples — three is enough.

## Privacy and responsibility

- Never surface names of individual private well owners or water-rights holders. Aggregate or facility-level only.
- Action drafts include a "review before sending" notice.
- The skill explicitly forbids the agent from causation language and personal-impact predictions.

## Useful commands

```bash
pnpm install
pnpm --filter @dryline/mcp dev          # run MCP server
pnpm --filter @dryline/mcp typecheck
pnpm --filter @dryline/mcp build
```

## Where to start

1. Verify the package builds and the server entry point speaks MCP.
2. Implement `resolve_location` end-to-end (Nominatim for geocoding; Census FIPS lookup; HUC-12 from a USGS dataset).
3. Implement `get_drought_status` against `usdmdataservices.unl.edu`.
4. Write the matching skill examples.
5. Then march through tools 3–5.

If you find yourself building tool 6+ before the skill has worked examples for tools 1–5, stop — the demo doesn't need it.
