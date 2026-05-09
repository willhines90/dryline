# Dryline — agent brief

You are working on **Dryline**, a Texas water environmental-intelligence tool built for the AITX × Codex Hackathon (May 9–10, 2026). This file is your project briefing. Read [`PROPOSAL.md`](./PROPOSAL.md) before any non-trivial change — it's the source of truth for scope, demo flow, and what to avoid.

## Repo layout

- `mcp/` — the MCP server: 8 bounded tools, all returning `{ data, caveats[], sources[] }`. DuckDB snapshot loader for groundwater wells, parcels, floodplain.
- `skill/` — agent skill (`/skill/SKILL.md`) that teaches *any* agent how to use the MCP responsibly. Worked examples and reference docs in `skill/references/`.
- `web/` — Next.js + MapLibre + shadcn/ui investigation surface: visible reasoning trace, cinematic demo sequence (address entry → map fly-to → trace streams → cards populate → tension flagged → synthesis → drafted artifact), mode toggle (Personal ↔ Transparency), Actions panel (drafted artifacts; hero is the public-comment draft).
- `fixtures/` — canonical demo inputs. The live-demo trio (Wimberley → Taylor/Samsung → Fort Stockton/Comanche Springs) must run cleanly in three minutes; see `fixtures/demo-addresses.json` for the full seven.

## The non-negotiable contract

Every MCP tool returns:

```ts
type ToolResult<T> = {
  data: T | null;
  caveats: Caveat[];   // freshness, confidence, what the data does NOT say
  sources: Source[];   // {title, url, retrievedAt}
};
```

`caveats` is *not* a comment field. It's the structured channel for:

- Data freshness (e.g., "USDM as of 2026-05-06; updated weekly")
- Known data quality issues (e.g., "TCEQ violations underreport; EPA acknowledges 3-6 month lag")
- What the data does NOT say (e.g., "presence of permit ≠ environmental harm")
- Confidence (e.g., "address resolution succeeded with 95% match")

`sources` is *every* upstream URL with a `retrievedAt` timestamp. The web app surfaces these. **No claim without a source.**

The wire types live in `mcp/src/types.ts`. The web app mirrors them by hand at `web/lib/types.ts` (clean runtime boundary; web does not import from `@dryline/mcp`). When `mcp/src/types.ts` changes, `web/lib/types.ts` must change in lockstep — typecheck-in-isolation will not catch drift.

## The eight MCP tools (priority order)

1. **`resolve_location(address)`** — lat/lng + county + watershed (HUC-12) + GCD + PWS ID. Foundation for everything else.
2. **`get_drought_status(address)`** — U.S. Drought Monitor REST API.
3. **`get_reservoirs(address, radius_mi)`** — TWDB Water Data for Texas REST.
4. **`get_drinking_water(pws_or_address)`** — EPA SDWIS via ECHO REST API.
5. **`get_big_users_nearby(address, radius_mi)`** — EPA ECHO regulated facilities (TCEQ proxy).
6. **`get_aquifer_status(address)`** — TWDB GWDB snapshot in DuckDB.
7. **`get_active_permits(address, radius_mi, since)`** — TCEQ permit data, ECHO proxy where available.
8. **`get_river_flow(address)`** — USGS NWIS REST API.

Tools 1–5 are the **minimum viable winning version** (see PROPOSAL.md fallback section). Build them first, end-to-end, with real source URLs and live API calls. Tools 6–8 ship if time allows.

## MCP conventions

- **TypeScript ESM everywhere.** Strict mode (`tsconfig.base.json`).
- **MCP TS SDK** (`@modelcontextprotocol/sdk`) — current API uses `Server` from `sdk/server/index.js` and `StdioServerTransport`.
- **Each tool in its own file** under `mcp/src/tools/`. Export a default `Tool<I, O>` instance. The registry (`mcp/src/tools/index.ts`) wires them up.
- **No throwing across the tool boundary.** If a fetch fails, return `{ data: null, caveats: [{ severity: 'error', message }], sources: [] }`. The agent must be able to reason about partial failure.
- **Cite source URL with retrievedAt timestamp on every result.** No exceptions.
- **DuckDB for snapshots only.** Live APIs don't pass through DuckDB.

## Web conventions

- **Imports:** `@dryline/mcp` and `@dryline/web` are the workspace package names.
- **Styling:** Tailwind + shadcn/ui. Aesthetic is topographic, not civic-tech blue. Reservoir blues against arid earth tones. See PROPOSAL.md → "Aesthetic direction."
- **Map library:** MapLibre GL (not Mapbox — token-free).
- **No localStorage in artifacts.** Use React state only.
- **No user accounts.** Subscribe button stores email; no auth.
- **No chat box.** The "Investigate" button + reasoning trace IS the interaction.
- **Mode toggle exists** but Personal mode is v1; Transparency mode is the stretch.
- **Surface caveats and sources in the UI.** No claim without a source. No "black box" answers. This is judged.

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

## What NOT to spend time on (from PROPOSAL.md)

- Don't perfect GIS layer styling — reservoir blue is enough.
- Don't integrate every dataset — eight tools is the ceiling.
- Don't build a chat interface.
- Don't build a settings page.
- Don't gold-plate typography — default shadcn is fine.
- Don't over-engineer deploy infra — Vercel + a single MCP host.

## Voice of the product

Quietly intelligent. Spare. Concrete. Cites everything. Never dramatizes risk. The agent reads like a careful field researcher, not a chatbot. UI copy follows the same rule.

## When you finish a feature, ask yourself

1. Does the user see citations and caveats? If no, add them.
2. Does the cinematic sequence still flow without stalls? If no, fix it before adding scope.
3. If you touched `mcp/src/types.ts`, did `web/lib/types.ts` move in lockstep?

## Useful commands

```bash
pnpm install
pnpm dev:web                            # http://localhost:3000
pnpm dev:mcp                            # MCP server on stdio (or HTTP per .env)
pnpm typecheck                          # whole monorepo
pnpm --filter @dryline/mcp typecheck
pnpm --filter @dryline/mcp build
```
