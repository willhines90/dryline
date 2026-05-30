# Dryline — agent brief

You are working on **Dryline**, a Texas water environmental-intelligence tool. It began at the AITX × Codex Hackathon (May 2026) and is now a **publicly launched product**, live at [dryline.org](https://dryline.org). This file is your project briefing and the source of truth for scope and focus. (`LANDSCAPE.md` carries the competitive analysis; `EXTENSIONS.md` is the roadmap. `PROPOSAL.md` holds deeper background but is local-only — don't assume a fresh clone has it.)

The phase has shifted: the build-to-demo sprint is over. The work now is **usage, partnerships, and product-market fit** — read "Focus now" below before picking up scope.

## Where Dryline sits in the ecosystem

Future agents pick up this project: do not let the positioning drift. Dryline is *not* a generic civic-data dashboard, *not* a chatbot for water questions, *not* a re-skin of TWDB. The wedge is sharper than that.

The one-line version: **the address-based environmental tools you know stop where water supply begins.** First Street / Risk Factor cover flood, fire, heat — never supply. EJScreen and ECHO are address-aware but not water-supply-focused. TWDB has the data but no consumer surface. TLWP / Sierra Club have the issue framing but no engineering. Dryline is the first product that stacks all four layers — **synthesis, interpretation, action, water-as-the-lens** — in one place, address-anchored, Texas-deep.

When making product decisions (new tools, new modes, scope changes, copy choices), check them against the wedge. Anything that pulls Dryline toward "general civic dashboard" or "chatbot for environmental questions" is drift; flag it instead of building it. Full analysis: [`LANDSCAPE.md`](./LANDSCAPE.md).

## Repo layout

- `mcp/` — the MCP server: 9 bounded tools, all returning `{ data, caveats[], sources[] }`. DuckDB snapshot loader for groundwater wells, parcels, floodplain.
- `skill/` — agent skill (`/skill/SKILL.md`) that teaches *any* agent how to use the MCP responsibly. Worked examples and reference docs in `skill/references/`.
- `web/` — Next.js + MapLibre + shadcn/ui investigation surface: visible reasoning trace, cinematic investigation sequence (address entry → map fly-to → trace streams → cards populate → tension flagged → synthesis → drafted artifact) — this is also the first-run onboarding for new visitors — mode toggle (Personal ↔ Transparency), Actions panel (drafted artifacts; hero is the public-comment draft).
- `fixtures/` — canonical sample inputs. The sample trio (Wimberley → Taylor/Samsung → Fort Stockton/Comanche Springs) anchors onboarding and the README walkthrough, and should still run cleanly; see `fixtures/demo-addresses.json` for the full seven.

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

## The nine MCP tools (priority order)

1. **`resolve_location(address, lat?, lng?)`** — lat/lng + county + watershed (HUC-12) + GCD + PWS ID. Foundation for everything else. Pass `lat`/`lng` to skip forward-geocoding (map features, resolved suggestions).
2. **`get_drought_status(address)`** — U.S. Drought Monitor REST API.
3. **`get_reservoirs(address, radius_mi)`** — TWDB Water Data for Texas REST.
4. **`get_drinking_water(pws_or_address)`** — EPA SDWIS via ECHO REST API.
5. **`get_big_users_nearby(address, radius_mi)`** — EPA ECHO regulated facilities (TCEQ proxy).
6. **`get_aquifer_status(address)`** — TWDB GWDB snapshot in DuckDB.
7. **`get_active_permits(address, radius_mi, since)`** — TCEQ permit data, ECHO proxy where available.
8. **`get_river_flow(address)`** — USGS NWIS REST API (discharge, cfs).
9. **`get_water_quality(lat, lng, radius_mi)`** — USGS NWIS in-situ water-quality sensors (specific conductance, nitrate, DO, pH, temperature, turbidity). Supply-relevant signals are conductance (salinity) + nitrate. Continuous sensors only; discrete lab samples (Water Quality Portal) are a future extension.

Tools 1–5 are the **minimum viable winning version** (see PROPOSAL.md fallback section). Build them first, end-to-end, with real source URLs and live API calls. Tools 6–9 ship if time allows.

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
- **Surface caveats and sources in the UI.** No claim without a source. No "black box" answers. This is the core trust contract — it's what makes the output usable in a story or a public comment.

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

## Focus now — launched product, civic wedge

The hackathon build is shipped and live. Priorities, in order:

1. **Usage & product-market fit.** Make the public tool reliable and legible for real visitors who arrive without context. Instrument *events and aggregate patterns* (modes used, actions drafted, conversions) to learn what lands — but **never log individual searched addresses** (see Privacy).
2. **The civic audience comes first.** The primary users are **journalists, civic researchers, and advocacy organizations** — people who investigate and act on Texas water professionally. Residents are the free public funnel and distribution surface; the water sector (GCDs, river authorities, utilities) is a later B2B/monetization path, not the opening move. When weighing a feature, ask: *does it help a reporter or advocate produce a cited, defensible artifact?* That's the wedge. A feature that only entertains a casual browser is lower priority.
3. **Trust is the product.** The cited synthesis, the structured caveats, and the drafted action artifacts (public comment, GCD letter, PIA request) are the moat — they're what a generic civic dashboard can't copy. Protect them above polish.

Guardrails that have **not** changed (resist scope creep here):

- No chat interface — the Investigate button + reasoning trace *is* the interaction.
- No settings page, no user accounts.
- Nine tools is the ceiling (`get_water_quality` was the last; resist a tenth).
- Don't gold-plate GIS styling or typography; don't over-engineer deploy infra (Vercel + a single MCP host is enough).

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
