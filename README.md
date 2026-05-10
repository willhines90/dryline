# Dryline

**Investigate Texas water at any address.**

*Environmental intelligence for a thirsty state.*

Built for the [AITX × Codex Hackathon](https://luma.com/aitx-codex-hackathon) (May 9–10, 2026, Antler ATX). Submitting to:
- **Brainforge / Vicinity Texas Open Data Track**
- **Agents Track**

**Live demo:** _(deployed URL pending — see PHASE 5)_
**Repo:** [github.com/willhines90/dryline](https://github.com/willhines90/dryline)

---

## The 90-second pitch

Texas water is opaque to the people who depend on it. The data is real, public, and federally cited — but it's spread across eight agencies, ten different reporting cadences, and a small library of state-only forms that don't have APIs. By the time a homeowner finds out their groundwater table dropped twelve feet last decade, or that a new fab three miles upstream just got a discharge permit, the comment window has closed.

Dryline collapses that distance. Type any Texas address. An agent fans out across drought, reservoirs, drinking water, aquifer monitoring, and federally-reportable industrial dischargers, returning each tool's result with **inline citations and structured caveats** — no black-box answers, no hedged guesses. A synthesis card lands the situation in 2–4 paragraphs of cited prose. A drafted artifact slides in from the right edge: a watering reminder, a well-outlook briefing, a public comment with a real NPDES permit ID, a letter to a Groundwater Conservation District, or a Public Information Act request.

Same investigation, two presentations:

| Mode | Question type | Default artifact |
|---|---|---|
| **Personal** — *Will the water last here?* | Lived-experience: well owners, utility customers, families considering a move. Leads with the local aquifer trend and the utility's compliance posture. | `watering_reminder` or `well_outlook_briefing` |
| **Transparency** — *Who's drinking your aquifer?* | Systemic: journalists, civic researchers, residents tracking nearby industrial buildouts. Leads with a *tension flag* pairing two facts (e.g., reservoir below historical average + large permitted draw nearby). | `public_comment`, `gcd_letter`, or `pia_request` |

---

## Screenshots

The cinematic flow, in three frames. Capture pass happens during PHASE 5 visual verification.

| | |
|---|---|
| **Map view** — All seven demo locations marked. Topographic basemap; reservoir-blue accents on arid earth. | ![map](docs/screenshots/01-map.png) |
| **Investigation in flight** — Reasoning trace streaming, citation chips alive, synthesis card materializing. | ![investigation](docs/screenshots/02-investigation.png) |
| **Public comment draft** — Actions tab open, drafted letter with cited NPDES IDs, *Review before sending* notice, copy-to-clipboard button. | ![public comment](docs/screenshots/03-public-comment.png) |

---

## Architecture choice — read this carefully

Dryline ships its tools as **both a stdio MCP server** (`@dryline/mcp`) **and as in-process function tools for the web app**. The web demo uses a deterministic tool sequence by default for sub-25 s reliability; an `?agent=1` query flag enables real LLM-driven tool selection via the OpenAI Responses API. The MCP server is the composable artifact — anyone can attach it to Claude Code, Codex, or Cursor. The agent's judgment shows up in synthesis emphasis, action-artifact selection, and citation discipline.

**Why deterministic by default for the web demo.** A managed agent loop adds model round-trips on top of `max(tool_latencies)`, which pushed dense-metro investigations to 50–70 s wall-clock under variable OpenAI load. Pre-fetching the six MVP tools after `resolve_location` keeps the cinematic trace identical from the user's side (`tool_start` and `tool_result` SSE events still stream in real time as each tool resolves) while bringing every investigation under the 25 s budget. The synthesis-only Responses API call is where the model's judgment lands — the system prompt is the [skill brief](skill/SKILL.md), the user message includes the fixture's narrative framing, and the artifact selection (and refusal to invent docket numbers) is the agent's call.

**The `?agent=1` flag.** Hit `POST /api/investigate?agent=1` and the same SSE contract is served by a real Responses-API tool-calling loop: the model sees all six tools, decides which to call (`resolve_location` is always first; the other five are at the model's discretion), and emits the same `tool_start`/`tool_result`/`synthesis`/`artifact` events. Capped at 50 s wall-clock and 8 iterations. We've observed the model legitimately *skip* tools — Personal-mode Wimberley dropped `get_big_users_nearby`; Fort Stockton sometimes drops `get_drinking_water` to focus on groundwater — which is the right judgment call but produces variable trace shapes that the deterministic path avoids. The flag is the honesty knob: judges who want to see the LLM driving tool selection can pop it on; live demos that need rehearsed timing keep it off.

The contract types (`mcp/src/types.ts` and the hand-mirrored `web/lib/types.ts`) are the wire boundary. The web app does not import from `@dryline/mcp` for type purposes other than to share the in-process registry; runtime decoupling stays clean so the MCP server can move to a different language without dragging the UI with it.

---

## Repo layout

```
dryline/
├── mcp/                  MCP server (stdio) + the canonical tool registry.
│   ├── src/tools/        One file per tool; all return { data, caveats[], sources[] }.
│   └── src/data/         Curated snapshots (TWDB GWDB → aquifers.json).
├── skill/                Agent skill: SKILL.md + worked examples + data-source catalog.
├── web/                  Next.js + MapLibre + shadcn/ui investigation surface.
│   ├── app/              page.tsx + the api/investigate SSE route.
│   ├── components/dryline/  Cinematic flow components.
│   └── lib/              Wire-type mirror, Markdown renderer, utils.
├── fixtures/             Canonical demo addresses.
├── PROPOSAL.md           Project thesis: scope, demo lineup, what not to build.
├── EXTENSIONS.md         Post-hackathon roadmap.
├── DEMO.md               Live three-minute demo script (beat sheet).
└── PITCH.md              Five-minute pitch narrative.
```

---

## Architectural contract — non-negotiable

Every MCP tool returns:

```ts
type ToolResult<T> = {
  data: T | null;          // null on partial failure; never throw across the boundary
  caveats: Caveat[];       // freshness, quality, bounds, inference — structured
  sources: Source[];       // {title, url, retrievedAt, publisher} — every claim cited
};
```

`caveats` is *not* a comment field. It's the structured channel for data freshness, known quality issues, what the data does NOT say, and confidence. The web app surfaces caveats and sources directly in the reasoning trace and the synthesis card. **No claim without a source.**

---

## Data sources

Each MCP tool draws from one or more of these. Mirrors [`skill/references/data-sources.md`](skill/references/data-sources.md) — the skill cites whichever the tool returns; this catalog is for human reviewers.

| Source | Publisher | Access | Updated | Caveat the agent surfaces |
|---|---|---|---|---|
| **Nominatim** | OpenStreetMap | REST | Live | Geocoding only; subject to OSM coverage |
| **Census Geocoder** | U.S. Census Bureau | REST | Live | 5xxs under load; we maintain a TX county FIPS fallback |
| **U.S. Drought Monitor** | NDMC / UNL / NOAA / USDA | REST at `usdmdataservices.unl.edu` | Weekly (Thursdays) | County-level summary; subcounty variation not captured |
| **TWDB Water Data for Texas** | TWDB | REST at `waterdatafortexas.org` | Daily | ~37 instrumented major reservoirs; minor systems not included |
| **EPA SDWIS via ECHO** | U.S. EPA | REST at `echodata.epa.gov` | Quarterly + ad hoc | EPA acknowledges 3–6 month state→federal reporting lag; some violations are paperwork, not contamination |
| **EPA ECHO Clean Water Act facilities** | U.S. EPA | REST at `echodata.epa.gov` (bbox + GeoJSON) | Continuous | Permitted ≠ polluting; federal-reportable only; NPDES is discharge, not draw |
| **TWDB Groundwater Database** | TWDB | Nightly pipe-delimited bulk dump | Nightly | Monitoring well coverage uneven; one well does not represent a whole aquifer; locations not state-verified |

**What we deliberately do NOT use:** TCEQ behind-form scraping, private well owner lists, real estate / parcel ownership databases. See [`skill/references/data-sources.md`](skill/references/data-sources.md) for the full attribution rule and exclusions list.

---

## Quickstart

```bash
git clone https://github.com/willhines90/dryline.git
cd dryline
pnpm install

# Configure secrets
cp .env.example .env
echo 'OPENAI_API_KEY=sk-...' > web/.env.local

# Terminal 1 — MCP server (stdio)
pnpm dev:mcp

# Terminal 2 — web app
pnpm dev:web
# → http://localhost:3000
```

Click any of the seven demo addresses → **Investigate**. The map flies to the address, the reasoning trace streams the tool calls, the synthesis card lands, the actions tab handle pulses on the right edge.

### Useful commands

```bash
pnpm typecheck                              # whole monorepo
pnpm build                                  # whole monorepo
pnpm --filter @dryline/mcp exec \
  tsx scripts/smoke.ts <tool> '<json-args>' # smoke test any tool
```

---

## Documents

- [PROPOSAL.md](./PROPOSAL.md) — full project thesis
- [EXTENSIONS.md](./EXTENSIONS.md) — post-hackathon roadmap
- [DEMO.md](./DEMO.md) — live demo beat sheet
- [PITCH.md](./PITCH.md) — five-minute pitch
- [SUBMISSION.md](./SUBMISSION.md) — Brainforge + Agents-track submission copy

---

## License

MIT. All public data is cited; we don't redistribute proprietary datasets.
