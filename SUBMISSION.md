# Dryline — submission

**Project name:** Dryline
**Tagline:** Investigate Texas water at any address.
**Tracks:** Brainforge / Vicinity Texas Open Data Track + Agents Track
**Hackathon:** [AITX × Codex Hackathon](https://luma.com/aitx-codex-hackathon), May 9–10 2026, Antler ATX

**Live demo:** https://dryline-web.vercel.app/
**Repo:** https://github.com/willhines90/dryline
**Demo addresses to try:**
- `Wimberley, Hays, TX` *(Personal mode)* — Trinity Aquifer, drought, Wimberley WSC
- `Taylor, Williamson, TX` *(Transparency mode)* — Samsung Taylor fab proximity, Lake Granger
- `Fort Stockton, Pecos, TX` *(Transparency mode)* — Edwards-Trinity Plateau, Belding history, Republic Water permit fight

---

## Track 1 — Brainforge / Vicinity Texas Open Data

Texas added 4 million people in five years. Our water didn't keep up. Texas publishes some of the richest water data in the country — but it's spread across multiple agencies and ingestion patterns, each with a different update cadence, access pattern, and freshness profile. **The address-based environmental tools you know stop where water supply begins.** First Street / Risk Factor scores flood and fire at any address but never water supply. EJScreen surfaces pollution and EJ indicators by Census block but isn't water-supply-focused. TWDB has the data but in dashboards built for analysts, not anchored to your address. The Texas Living Waters Conservation Scorecard gets the issue right but ships as a PDF. Dryline collapses that distance into a single map-first investigation surface. Type any Texas address; an autonomous flow returns an inline-cited synthesis of drought stage, drinking-water compliance, reservoir status, aquifer monitoring trend, federally-reportable industrial dischargers within a 15-mile radius, nearby USGS stream-gauge discharge, and active EPA-tracked permits. Every fact-bearing sentence links to its public source URL with a `retrievedAt` timestamp; every result carries structured `caveats` describing freshness, coverage, and what the data does NOT say.

The demo trio lands three concrete Texas water stories. **Wimberley:** the Trinity Aquifer's local trend, read off the nearest TWDB monitoring well. **Taylor:** Samsung Austin Semiconductor's NPDES discharge footprint paired with Lake Granger's current percentage of historical average. **Fort Stockton:** the Edwards-Trinity Plateau, the 1954 *Pecos County WCID v. Williams* decision (the Belding case) that legalized rule-of-capture, and the live Republic Water permit echoing the same dispute seventy years later. All of it is public data, cited at retrieval time, threaded through a visible reasoning trace and a drafted action artifact — review-before-sending, never auto-submit.

Full competitive analysis: [LANDSCAPE.md](./LANDSCAPE.md).

---

## Track 2 — Agents

Dryline ships its tools in two forms. **`@dryline/mcp` is a stdio MCP server** — eight bounded tools (`resolve_location`, `get_drought_status`, `get_reservoirs`, `get_drinking_water`, `get_big_users_nearby`, `get_aquifer_status`, `get_river_flow`, `get_active_permits`), each returning the non-negotiable `{ data, caveats[], sources[] }` shape. Any agent runtime — Claude Code, Codex, Cursor, or a custom OpenAI loop — can attach the server and receive cited Texas water data with structured uncertainty. The agent skill at [`skill/SKILL.md`](skill/SKILL.md) teaches *any* attached agent how to use the tools responsibly: when to invoke which (decision rubric mapping question types to tool sequences); how to combine results without overclaiming (`permitted ≠ polluting`, `correlation ≠ causation`); citation discipline (every sentence in the synthesis links to a source); action-drafting rules (when to draft a public comment vs a GCD letter vs a PIA request); the required disclaimers; and three worked examples with full reasoning traces.

The web demo's hot path imports the same tool registry in-process and dispatches it as Responses-API function calls. The current default is a deterministic eight-tool sequence followed by a synthesis-only model call — chosen for sub-25-second wall-clock reliability under variable OpenAI load. An `?agent=1` query flag swaps in a real LLM-driven tool-calling loop on the same SSE contract; the model decides which of the eight tools to call, capped at 50 s and 8 iterations. We've watched it legitimately skip tools — `get_big_users_nearby` in Personal mode, `get_drinking_water` when the narrative is groundwater-focused. Agent judgment shows up where it matters either way: in synthesis emphasis (aquifer-led for personal mode, tension-flag-led for transparency mode), in action-artifact selection (`watering_reminder` vs `well_outlook_briefing` vs `public_comment` vs `gcd_letter` vs `pia_request`), in citation discipline (no invented TCEQ docket numbers — public-comment drafts cite real NPDES IDs from `get_big_users_nearby`), and in refusing to use causation language or personal-impact predictions even when the headline narrative would benefit. The MCP server stays the composable artifact for any external agent runtime to inherit the same behavior.

**Build itself.** Solo human, two coding agents in parallel: **Codex** owned `/web` (Next.js + MapLibre + shadcn/ui), **Claude Code** owned `/mcp` (the MCP server + the eight tools) and `/skill` (SKILL.md + references). Each on its own git worktree per [`MERGE.md`](./MERGE.md), human merging on main. The build itself is a working illustration of multi-agent coding: two AI pair-programmers driving complementary slices of the project, one human keeping the contract types in lockstep. Sponsor utility lands twice — Codex shipped the surface, Claude Code shipped the protocol layer.
