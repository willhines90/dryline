# Merge protocol

This repo runs **multiple coding agents in parallel** on separate worktrees. That keeps the git index from colliding, but it does NOT prevent semantic coupling between packages. Read this before merging anything non-trivial.

## Worktree topology

| Worktree | Branch | Owner | Beat |
|---|---|---|---|
| `dryline/` (main) | `main` | Human | Reviews & merges |
| `dryline-mcp/` | `mcp-build` | Claude Code | `/mcp` + `/skill` |
| `dryline-web/` | `web-build` | Codex | `/web` |

Set them up once:

```bash
cd dryline
git worktree add ../dryline-mcp -b mcp-build
git worktree add ../dryline-web -b web-build
```

If you're running through **Conductor**, let Conductor create the worktrees instead — it tracks them in its UI and you don't have to remember the branch names. Conductor will pick branch names; the topology above is the convention to recreate either way.

## The contract coupling — read this twice

`mcp/src/types.ts` defines `Source`, `Caveat`, and `ToolResult<T>`.
`web/lib/types.ts` is a **hand-mirrored copy** of those types.

The web app does not import from `@dryline/mcp` directly (clean boundary, runtime decoupling). That means:

> **When `mcp/src/types.ts` changes, `web/lib/types.ts` MUST change in lockstep.**

This will not be caught by typecheck-in-isolation. It WILL be caught by the post-merge typecheck on `main`. Do that every time.

If the MCP-build agent (Claude Code) modifies the contract types, its commit message MUST start with `contract:` so the human knows to also update `web/lib/types.ts` (or assign it as Codex's next task).

## Merge cadence

- **At least once per session.** Don't let a worktree drift for more than ~2 hours of work.
- **Before a working feature in one worktree depends on a change in another.** E.g., before Codex wires the Investigate button to the MCP, the MCP server should already be reachable.
- **Always merge to `main` first.** Don't merge `mcp-build` into `web-build` or vice versa. That creates loops.

## Merge protocol (run these from `main`)

```bash
cd dryline   # main worktree
git fetch --all

# Bring in MCP work first (it's the contract source).
git merge mcp-build --no-ff -m "merge: mcp-build into main"

# Then web. If the contract changed, this is when web/lib/types.ts must already match.
git merge web-build --no-ff -m "merge: web-build into main"

# Verify.
pnpm typecheck   # whole monorepo
pnpm build       # whole monorepo

# Push if you're using a remote.
git push origin main
```

If `pnpm typecheck` fails after the merge, the most likely cause is the contract drift described above. Fix `web/lib/types.ts` or fix the MCP types and re-merge. Don't ship a green build that hides a contract mismatch.

## Conflict zones to expect

- **`pnpm-lock.yaml`** — if both worktrees added a dependency, you'll get a lockfile conflict. Resolve by running `pnpm install` from `main` after the textual merge; let pnpm regenerate.
- **Root `package.json`** — workspace scripts may conflict if both agents added one. Manual resolution.
- **`mcp/src/types.ts` ↔ `web/lib/types.ts`** — see contract coupling above.
- **Nothing else should ever conflict.** If it does, an agent strayed outside its beat — that's a coordination issue, not a merge issue.

## If something breaks after a merge

1. Don't panic-fix on `main`. Reset.
   ```bash
   git reset --hard HEAD~1   # undoes the most recent merge
   ```
2. Go back to the worktree that introduced the regression and fix it there.
3. Re-merge.
4. If the bad commit was on `mcp-build` or `web-build` and is already merged, fix forward on the appropriate worktree and merge again.

## Coordination outside the repo

This file covers in-repo merges. The full coordination loop runs across:

- **Conductor** — worktree dashboard; assigns tasks to agents; visible status
- **Claude Code (terminal, via Conductor)** — `/mcp` + `/skill` agent
- **Codex (terminal, via Conductor)** — `/web` agent
- **Claude (app, in Cowork mode)** — planning, demo prep, document updates, ideation, judgment calls. Not in the build loop. Use it between sessions to reset, rewrite the proposal, prep the demo script, write README copy.

The human (Will) is the conductor of the orchestra. He bounces between Conductor's UI, the Cowork chat for planning, and the running localhost:3000 to watch the demo come together. He doesn't sit in any one terminal for long.
