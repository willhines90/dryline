# Dryline

**Investigate Texas water at any address.**

*Environmental intelligence for a thirsty state.*

Built for the [AITX × Codex Hackathon](https://luma.com/aitx-codex-hackathon), May 9–10 2026, at Antler ATX. Submitting to the Brainforge / Vicinity Texas Open Data Track and the Agents Track.

> See [`PROPOSAL.md`](../PROPOSAL.md) in the parent directory for the full project thesis: pitch, demo lineup, architecture, scope, attribution, and what NOT to spend time on.

## What Dryline does

Type any Texas address. An agent autonomously investigates the water situation around that location — drinking water, drought, reservoirs, aquifers, big users, active permits — and produces:

1. A synthesized summary with inline citations to public sources
2. A drafted action artifact: a public comment, GCD letter, or weekly briefing

Two demo modes (same investigation, different presentation):

- **Personal mode** — *Will the water last here?*
- **Transparency mode** — *Who's drinking your aquifer?*

## Repo layout

```
dryline/
├── mcp/             # MCP server: tools that fetch & summarize Texas water data
│   └── src/tools/   # One file per tool; all return { data, caveats[], sources[] }
├── skill/           # Agent skill: SKILL.md + references for safe tool use
├── web/             # Next.js + MapLibre map-first investigation UI
└── fixtures/        # Demo-address fixtures (the seven canonical locations)
```

## Architectural contract — non-negotiable

Every MCP tool returns:

```ts
type ToolResult<T> = {
  data: T;
  caveats: Caveat[];   // freshness, confidence, what the data does NOT say
  sources: Source[];   // {title, url, retrievedAt} — every claim is citable
};
```

The agent's investigation surfaces `caveats` and `sources` in the UI. No black-box answers.

## Quickstart

```bash
pnpm install
cp .env.example .env   # fill in OPENAI_API_KEY

# Terminal 1 — MCP server
pnpm dev:mcp

# Terminal 2 — Web app
pnpm dev:web
```

Open http://localhost:3000.

## Data sources

| Source | Access | Use |
|---|---|---|
| TWDB Water Data for Texas | REST API | Reservoir levels |
| U.S. Drought Monitor | REST API + GeoJSON | Drought category by county |
| USGS NWIS Water Services | REST API | Stream gauge real-time + historical |
| EPA SDWIS via ECHO | REST API | Drinking water violations |
| TWDB Groundwater Database | Nightly bulk download → DuckDB | Aquifer monitoring wells |
| TNRIS Floodplain Quilt | Bulk download → pre-processed GeoJSON | Flood exposure |
| TNRIS StratMap parcels | Bulk download → DuckDB | Parcel context |
| EPA ECHO regulated facilities | REST API | Big water users (TCEQ proxy) |

Data freshness is reflected in every tool's `caveats` field. See [`mcp/README.md`](mcp/README.md) for snapshot loading instructions.

## Where Dryline goes next

The seven demo addresses cover Hill Country, Central TX, the Coast/East, West/Trans-Pecos, the Panhandle, and Far West. The Coastal Bend (Corpus Christi) and Rio Grande Valley have great water stories but need more careful framing than a hackathon weekend allows — they're explicit follow-up regions.

Long-term adjacencies: climate resilience tooling, municipal intelligence, environmental due diligence, real estate intelligence, civic monitoring.

## License

MIT. All public data is cited; we don't redistribute proprietary datasets.
