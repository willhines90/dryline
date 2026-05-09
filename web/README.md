# @dryline/web

Next.js + MapLibre + shadcn/ui investigation surface for Dryline.

> Read `../AGENTS.md` and `../PROPOSAL.md` before making non-trivial changes.

## What lives here

- `app/page.tsx` — the single-page investigation surface (map + side panel + reasoning trace)
- `app/api/investigate/` — server route that calls the MCP server and streams the agent loop back to the client
- `components/dryline/` — feature components (Map, ResultCard, ReasoningTrace, ActionsTab, etc.)
- `lib/types.ts` — wire types mirroring the MCP server's `{data, caveats, sources}` contract

## Aesthetic

Topographic. Map-first. Reservoir blues against arid earth tones. Contour-line motif as a recurring detail. Skip civic-tech blue-and-orange; it telegraphs "government website."

Palette anchors live in `tailwind.config.ts` (`reservoir-*`, `arid-*`) and in `app/globals.css` (shadcn semantic tokens layered over the stone base).

## Running

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
```

You also need the MCP server running for the investigation flow. From the repo root:

```bash
pnpm dev:mcp      # in another terminal
```

## What's not done yet

The page currently renders a placeholder map area and the seven demo addresses from `../fixtures/demo-addresses.json`. Codex agents pick up from here:

- Wire MapLibre with a topographic basemap (e.g., MapTiler topo-v2 with no token, or open OSM-style)
- Build the cinematic investigation sequence in `components/dryline/InvestigateFlow.tsx`
- Build the result-card stack in `components/dryline/SidePanel.tsx`
- Build the reasoning trace stream in `components/dryline/ReasoningTrace.tsx`
- Build the Actions tab + the public-comment-draft renderer in `components/dryline/ActionsTab.tsx`
- Server route at `app/api/investigate/route.ts` that orchestrates the agent loop via OpenAI Responses API + MCP

The hero artifact is the public-comment draft. Polish that one first.
