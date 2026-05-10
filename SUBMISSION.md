# Dryline — submission

**Project name:** Dryline
**Tagline:** Investigate Texas water at any address.
**Tracks:** Brainforge / Vicinity Texas Open Data Track + Agents Track
**Hackathon:** [AITX × Codex Hackathon](https://luma.com/aitx-codex-hackathon), May 9–10 2026, Antler ATX

**Live demo:** _(deployed URL pending PHASE 5)_
**Repo:** https://github.com/willhines90/dryline
**Demo addresses to try:**
- `Wimberley, Hays, TX` *(Personal mode)* — Trinity Aquifer, drought, Wimberley WSC
- `Taylor, Williamson, TX` *(Transparency mode)* — Samsung Taylor fab proximity, Lake Granger
- `Fort Stockton, Pecos, TX` *(Transparency mode)* — Edwards-Trinity Plateau, Belding history, Republic Water permit fight

---

## Track 1 — Brainforge / Vicinity Texas Open Data

Texas publishes some of the richest water data in the country across TWDB, EPA ECHO/SDWIS, USGS NWIS, and the U.S. Drought Monitor — but the data lives in eight separate places, each with its own update cadence, its own access pattern (REST API, nightly pipe-delimited bulk dump, web form, GeoJSON), and its own freshness caveats. Dryline collapses that distance into a single map-first investigation surface. Type any Texas address; an autonomous flow returns an inline-cited synthesis of drought stage, drinking-water compliance, reservoir status, aquifer monitoring trend, and federally-reportable industrial dischargers within a 15-mile radius. Every fact-bearing sentence links to its public source URL with a `retrievedAt` timestamp; every result carries structured `caveats` describing freshness, coverage, and what the data does NOT say.

The demo trio lands three concrete Texas water stories: Wimberley confronts the Trinity Aquifer's local trend at the nearest TWDB monitoring well; Taylor pairs Samsung Austin Semiconductor's NPDES discharge footprint with the Lake Granger reservoir's percentage of historical average; Fort Stockton draws on the Edwards-Trinity Plateau alongside the rule-of-capture history that runs from the 1954 *Pecos County WCID v. Williams* decision to the live Republic Water permit application. Public data, cited at the source, threaded through a cinematic reasoning trace and a drafted action artifact (a watering reminder, a public comment with a real NPDES permit ID, a GCD letter, or a Public Information Act request) — review-before-sending, never auto-submit.

---

## Track 2 — Agents

Dryline ships its tools in two forms. **`@dryline/mcp` is a stdio MCP server** — six bounded tools (`resolve_location`, `get_drought_status`, `get_reservoirs`, `get_drinking_water`, `get_big_users_nearby`, `get_aquifer_status`), each returning the non-negotiable `{ data, caveats[], sources[] }` shape. Any agent runtime — Claude Code, Codex, Cursor, or a custom OpenAI loop — can attach the server and receive cited Texas water data with structured uncertainty. The agent skill at [`skill/SKILL.md`](skill/SKILL.md) teaches *any* attached agent how to use the tools responsibly: when to invoke which (decision rubric mapping question types to tool sequences); how to combine results without overclaiming (`permitted ≠ polluting`, `correlation ≠ causation`); citation discipline (every sentence in the synthesis links to a source); action-drafting rules (when to draft a public comment vs a GCD letter vs a PIA request); the required disclaimers; and three worked examples with full reasoning traces.

The web demo's hot path imports the same tool registry in-process and dispatches it as Responses-API function calls. The current default is a deterministic six-tool sequence followed by a synthesis-only model call — chosen for sub-25-second wall-clock reliability under variable OpenAI load and surfaced honestly in the README's architecture section. Agent judgment shows up where it matters: in synthesis emphasis (aquifer-led for personal mode, tension-flag-led for transparency mode), in action-artifact selection (`watering_reminder` vs `well_outlook_briefing` vs `public_comment` vs `gcd_letter` vs `pia_request`), in citation discipline (no invented TCEQ docket numbers — public-comment drafts cite real NPDES IDs from `get_big_users_nearby`), and in refusing to use causation language or personal-impact predictions even when the headline narrative would benefit. The MCP server stays the composable artifact for any external agent runtime to inherit the same behavior.
