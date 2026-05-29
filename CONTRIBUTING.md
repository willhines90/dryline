# Contributing to Dryline

Thanks for your interest in Dryline. This is an open-source, address-based
water-supply intelligence tool for Texas. Contributions are welcome — bug
reports, data-source corrections, new bounded tools, UI polish, and skill
improvements all help.

Please read this guide before opening a pull request. By participating you
agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## The one rule that matters most

**No claim without a source.** Every fact Dryline surfaces is backed by a cited
upstream URL with a `retrievedAt` timestamp, and every uncertainty is declared
in a structured `caveat`. This is the heart of the project — it is what makes
Dryline trustworthy rather than just another dashboard. A change that adds a
claim, number, or interpretation without a corresponding source and honest
caveats will not be merged.

Every MCP tool returns the same shape:

```ts
type ToolResult<T> = {
  data: T | null;
  caveats: Caveat[];   // freshness, confidence, what the data does NOT say
  sources: Source[];   // { title, url, retrievedAt }
};
```

`caveats` is a structured channel, not a comment field — use it for data
freshness, known data-quality issues, what the data does *not* say, and
confidence. The web app surfaces both caveats and sources in the UI.

## Project layout

| Directory   | What lives here |
|-------------|-----------------|
| `mcp/`      | The MCP server — bounded tools returning `{ data, caveats, sources }`. DuckDB snapshot loader for groundwater wells, parcels, floodplain. |
| `skill/`    | The agent skill (`skill/SKILL.md`) that teaches any agent how to use the MCP responsibly, with worked examples in `skill/references/`. |
| `web/`      | Next.js + MapLibre + shadcn/ui investigation surface: visible reasoning trace, cinematic demo sequence, mode toggle, Actions panel. |
| `fixtures/` | Canonical demo inputs. The live-demo trio must run cleanly. |

## Getting set up

Requirements: Node 20+, [pnpm](https://pnpm.io/).

```bash
pnpm install
cp .env.example .env          # configure as needed
pnpm dev:web                  # http://localhost:3000
pnpm dev:mcp                  # MCP server on stdio (or HTTP per .env)
```

Before pushing, the whole monorepo must typecheck:

```bash
pnpm typecheck
```

You can smoke-test any MCP tool directly:

```bash
pnpm --filter @dryline/mcp exec tsx scripts/smoke.ts <tool> '<json-args>'
```

## Conventions

**MCP server**
- TypeScript ESM everywhere, strict mode.
- Each tool in its own file under `mcp/src/tools/`, exporting a default
  `Tool<I, O>` instance; the registry (`mcp/src/tools/index.ts`) wires them up.
- **Never throw across the tool boundary.** If a fetch fails, return
  `{ data: null, caveats: [{ severity: 'error', message }], sources: [] }` so
  the agent can reason about partial failure.
- Cite the source URL with a `retrievedAt` timestamp on every result.
- DuckDB is for snapshots only — live APIs never pass through it.

**Web app**
- Tailwind + shadcn/ui. The aesthetic is topographic, not civic-tech blue —
  reservoir blues against arid earth tones.
- MapLibre GL (token-free), not Mapbox.
- No chat box, no user accounts, no settings page. The "Investigate" button and
  the reasoning trace *are* the interaction.
- Surface caveats and sources in the UI. No black-box answers.

**Types move in lockstep.** The wire types live in `mcp/src/types.ts`. The web
app mirrors them by hand at `web/lib/types.ts` (clean runtime boundary — web
does not import from `@dryline/mcp`). If you change one, change the other in the
same PR — typecheck-in-isolation will not catch the drift.

## Privacy and responsibility

These are hard constraints, not preferences:

- Never surface the names of individual private well owners or water-rights
  holders. Aggregate or facility-level only.
- No causation language and no personal-impact predictions. Permitted ≠
  polluting; correlation ≠ causation.
- Action drafts always include a "review before sending" notice. Dryline drafts
  artifacts; it never auto-submits.
- Dryline does not provide legal or health advice, and contributions must not
  imply otherwise.

## Voice

Quietly intelligent. Spare. Concrete. Cites everything. Never dramatizes risk.
UI copy and docs read like a careful field researcher, not a chatbot. Match it.

## Pull request checklist

- [ ] `pnpm typecheck` passes across the monorepo.
- [ ] Every new claim has a source and honest caveats.
- [ ] If you touched `mcp/src/types.ts`, `web/lib/types.ts` moved with it.
- [ ] No individual private well owners or water-rights holders are named.
- [ ] No causation or personal-impact language crept in.
- [ ] Commit messages are clear; the PR description explains the *why*.

Open an issue first for anything large or architectural — it's the fastest way
to align before you invest in a big change. Thank you for contributing.
