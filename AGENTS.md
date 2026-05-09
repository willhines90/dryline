# Dryline — Codex agent brief

You are working on **Dryline**, a Texas water environmental-intelligence tool built for the AITX × Codex Hackathon (May 9–10, 2026). This file is your project briefing. Read [`PROPOSAL.md`](../PROPOSAL.md) before any non-trivial change — it's the source of truth for scope, demo flow, and what to avoid.

## Your beat in this repo

Codex owns **`/web`**. Specifically:

- The Next.js + MapLibre + shadcn/ui investigation surface
- The visible reasoning trace
- The cinematic demo sequence (address entry → map fly-to → trace streams → cards populate → tension flagged → synthesis → drafted artifact)
- The mode toggle (Personal ↔ Transparency)
- The Actions panel (drafted artifacts: hero is the public-comment draft)

Claude Code owns `/mcp` and `/skill`. Don't edit those without coordinating — they have their own contract you must consume, not redefine.

## What "done" looks like for the live demo

The live-demo trio of addresses (Wimberley → Taylor/Samsung → Fort Stockton/Comanche Springs) must run cleanly in three minutes with the cinematic sequence above. See [`fixtures/demo-addresses.json`](fixtures/demo-addresses.json) for the canonical seven.

## Architecture you must consume, not redefine

The MCP server returns every tool result in this shape:

```ts
type ToolResult<T> = {
  data: T;
  caveats: Caveat[];   // freshness, confidence, what the data does NOT say
  sources: Source[];   // citation: title, url, retrievedAt
};
```

The web app must surface `caveats` and `sources` in the UI. No claim without a source. No "black box" answers. This is judged.

## Conventions

- **TypeScript everywhere.** Strict mode is on (`tsconfig.base.json`).
- **Imports:** `@dryline/mcp` and `@dryline/web` are the workspace package names.
- **Styling:** Tailwind + shadcn/ui. Aesthetic is topographic, not civic-tech blue. Reservoir blues against arid earth tones. See PROPOSAL.md → "Aesthetic direction."
- **Map library:** MapLibre GL (not Mapbox — token-free).
- **No localStorage in artifacts.** Use React state only.
- **No user accounts.** Subscribe button stores email; no auth.
- **No chat box.** The "Investigate" button + reasoning trace IS the interaction.
- **Mode toggle exists** but Personal mode is v1; Transparency mode is the stretch.

## What NOT to spend time on (from PROPOSAL.md)

- Don't perfect GIS layer styling — reservoir blue is enough.
- Don't integrate every dataset — eight tools is the ceiling.
- Don't build a chat interface.
- Don't build a settings page.
- Don't gold-plate typography — default shadcn is fine.
- Don't over-engineer deploy infra — Vercel + a single MCP host.

## When you finish a feature, ask yourself

1. Does the user see citations and caveats? If no, add them.
2. Does the cinematic sequence still flow without stalls? If no, fix it before adding scope.
3. Did I touch `/mcp` or `/skill`? If yes, surface that to the human — Claude Code is responsible for those.

## Useful commands

```bash
pnpm install
pnpm dev:web        # http://localhost:3000
pnpm dev:mcp        # MCP server on stdio (or HTTP per .env)
pnpm typecheck
```

## Voice of the product

Quietly intelligent. Spare. Concrete. Cites everything. Never dramatizes risk. The agent reads like a careful field researcher, not a chatbot. UI copy follows the same rule.
