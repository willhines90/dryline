# Dryline — Loom Demo Script

**Format:** Loom screen recording with webcam on (PiP).
**Tier:** Loom Free — 5-minute ceiling. **Target: 3:30–4:00.** Leave 60s of buffer.
**Style:** Single take. Conversational, not stagey. Build narration interleaved with the live demo, not bolted on.
**Required sections (per AITX brief):** team intro · 30s elevator pitch · live demo · build narration · so-what close.

> **Verbatim** lines are in quotes — say these as written. **Beat** descriptions are camera/screen direction and adlib-friendly framing. **Build cues** are tech callouts to drop in *during* the demo, not after.

---

## Pre-flight checklist

Before you press Record:

- [ ] **Mic & camera test.** Loom test-recording 10 seconds. Listen back. If the room is echoey, throw a hoodie over a couple of hard surfaces.
- [ ] **Lighting.** Face the window or a soft lamp; no backlight from a window behind you (Loom auto-exposes for the bright thing).
- [ ] **Webcam framing.** Eyes in the upper third of the bubble. Don't sit too close.
- [ ] **Browser:** zoomed to ~110%, address bar hidden, only Dryline tab visible (or Dryline + one Notion notes tab if you want the beat sheet on screen).
- [ ] **Mode:** toggle defaulted to **Personal**. Three demo-address buttons visible.
- [ ] **MCP server warmed up.** Run a throwaway investigation in the last 5 min so caches are hot.
- [ ] **Notifications off.** macOS Do Not Disturb on. Slack quit. Calendar quit.
- [ ] **Backup tab.** A second tab pre-loaded with a successful Wimberley result, in case the live MCP call hangs.
- [ ] **Beat sheet.** This file open on a second monitor or printed. Don't read from it on screen.
- [ ] **One dry run.** Do a full take before the real one. Most first-takes are 25% too long.

---

## Section 1 — Team intro (0:00–0:20) · camera primary

**On screen:** Your face, full webcam. Dryline tab in background, blurred or static.
**Energy:** Calm. Not "podcast-host" calm — calm-because-you-built-the-thing.

**Verbatim:**
> "Hey — I'm Will Hines. Solo human, AITX × Codex Hackathon. The interesting bit: I built this with two coding agents working in parallel — Codex on the Next.js web app, Claude Code on the MCP server and the agent skill — each on its own git worktree, with me merging on main. Three pieces of code, two AI pair-programmers, one solo person. The project is called Dryline."

**Discipline:** Don't say "Hi everyone" or "thanks for watching." Get to the work. The two-agents-in-parallel detail is itself a credible Agents Track artifact — let it land.

---

## Section 2 — Elevator pitch (0:20–0:55) · camera primary, pivot to screen at the end

**On screen:** Still your face. Around 0:45, switch to the Dryline map.
**Energy:** This is the trailer. Slow down on the load-bearing line.

**Verbatim:**
> "Texas added 4 million people in five years. Our water didn't keep up. The data exists — across TWDB, USGS, EPA, TCEQ — but it's scattered across five sites that don't talk to each other. And the address-based tools you do know — First Street, EJScreen — stop where water supply begins.
>
> Dryline is what fills that gap. Type any Texas address. An agent investigates the water situation across six public datasets, cites every claim, and drafts a concrete civic action — usually a public comment on a live TCEQ permit. It's for homeowners who want to know if the water will last, and for citizens and journalists who want to know who's drinking their aquifer."

**Discipline:** Pause one full second after "where water supply begins." That's the wedge — let the viewer feel it land before you describe the product.

**Hand-off cue:** "Let me show you" → click into the map.

---

## Section 3 — Live demo with build narration interleaved (0:50–3:00) · screen primary, camera PiP

**On screen:** Dryline web app. Webcam shrinks to a corner bubble.
**Energy:** Show, don't sell. Talk over the screen, never read from it.
**Architecture trick:** Each demo beat carries a **build cue** — a short sentence about how the thing on screen actually works. That's how you hit "narrate how you built it" without a separate technical section.

### Demo 1 — Wimberley (0:55–1:45, ~50s)

**Mode:** Personal · *Will the water last here?*

| # | On screen | Spoken |
|---|---|---|
| 1.1 | Click **Wimberley**. Map flies to a Hill Country parcel. | "A weekend home in Wimberley. Personal mode — same agent, framed for a homeowner." |
| 1.2 | Reasoning trace streams on the right rail. | **Build cue (Agents Track):** "What you're seeing here is the OpenAI Responses API doing real tool-calling against my MCP server. The agent picks which tools to fire — I've watched it skip Big Users for personal-mode rural addresses, skip Drinking Water when the story is groundwater. That's the agent making decisions, not following a script." |
| 1.3 | Result cards populate — Drinking Water, Drought, Reservoirs, Aquifer. The Aquifer card animates in with a 20-year decline. | "Wimberley sits on the Trinity Aquifer. About half the homes here are on private wells. You can see the long decline." |
| 1.4 | Drought card surfaces Stage 4 watering rules. | "Stage 4 right now. The rules card is parsed straight from the utility's notice." |
| 1.5 | Synthesized summary lands. Hover one citation chip. | **Build cue (Open Data Track):** "Every fact-bearing sentence links to the source URL with a retrieval timestamp. That's the contract every tool returns — `data, caveats, sources` — public Texas data with attribution baked into the protocol. The agent literally cannot make a claim without a source." |

**Time check:** Should hit ~1:45 here. If you're already at 1:55, skip Demo 1.4 (drought card narration) on the next take.

---

### Demo 2 — Taylor (1:45–2:55, ~70s) · the hero artifact

**Mode:** Transparency · *Who's drinking your aquifer?*

| # | On screen | Spoken |
|---|---|---|
| 2.1 | Toggle mode → **Transparency**. Click **Taylor**. Map flies to the Samsung site. | "Transparency mode. Same investigation, different judgment about what to surface." |
| 2.2 | Map zooms in. Samsung fab footprint highlighted. Lake Granger to the north, Trinity Aquifer shaded beneath. | **Verbatim:** *"Samsung's Taylor fab. A $17 billion semiconductor plant in a town of 16,000 people. Its NPDES discharge — that's the federally permitted draw — is roughly equivalent to the daily water use of 17,000 Texas households. Lake Granger is at 67% of historical for this date."* |
| 2.3 | **Big Users** card resolves with real NPDES IDs. | **Build cue (Open Data Track):** "Those NPDES IDs are pulled live from EPA ECHO — the Enforcement and Compliance History API. I'm using the federal facility list as a proxy because TCEQ doesn't expose a clean public API — that's an honest accuracy choice the brief asks for. The skill explicitly forbids the agent from inventing docket numbers, so what you see is real." |
| 2.4 | The agent surfaces a **flagged tension** banner: *"Aquifer monitoring well decline AND a 4.2 MGD permit filed nearby in March 2026."* | **Verbatim:** *"This is the moment that makes the agent useful. It cross-referenced two things on its own — the aquifer is in decline, AND a 4.2 million-gallon-per-day permit was filed nearby in March. No human told it to put those side by side."* |
| 2.5 | Pause one full beat. | *(silence — count 1-Mississippi)* |
| 2.6 | Click **Actions**. Drafted **public comment** for the open TCEQ permit slides in. | **Verbatim:** *"And here's what I'd call the hero artifact. A drafted public comment, addressed correctly, with the docket number, with every fact cited, ending in a specific, actionable ask."* |
| 2.7 | Scroll briefly so the citations show. | **Build cue (both tracks):** "Two technical deliverables here — the open-source MCP server, eight bounded tools, plus a portable agent skill. The brief said teams shipping both would be especially competitive. Anyone can attach the MCP server to Claude Code or Codex tomorrow and inherit the same Texas water tools." |
| 2.8 | Show the *Review before sending* affordance. | **Verbatim:** *"This is the moment Dryline stops being a tool and starts being an agent. Public data went in. A fileable civic action came out — review-before-sending, never auto-submit."* |

**Time check:** Should hit ~2:55. If 3:05+, skip 2.7 (the build-cue scroll) on next take.

---

## Section 4 — So what + close (3:00–3:45) · camera primary

**On screen:** Camera goes back to full size. Dryline tab visible behind, on the synthesized summary card.
**Energy:** Land it. Slow down.

**Verbatim:**
> "Why this matters. Texas water is the story of this decade in this state — drought, aquifer depletion, hyperscale data centers, semiconductor fabs, all drawing from a finite stack. The data is public. The civic-comment process is public. But the distance between the two is what stops people from acting. Dryline closes that distance.
>
> Everything is open source, MIT-licensed. The MCP server stands alone — anyone can attach it to Claude Code or Codex tomorrow and inherit the same Texas water tools. The agent skill is portable. We've covered seven Texas water regions today, with the Coastal Bend and the Rio Grande Valley as the obvious next two.
>
> Long-term, this becomes environmental due diligence for the state. Thanks."

**Discipline:** Land *"environmental due diligence for the state"* without rushing into "thanks." Half a beat between them.

**Final frame:** Webcam on you. Don't reach for the stop button until you've held the smile for one full second. Loom edits in a few extra frames at the end either way; the held smile is the thumbnail.

---

## Track-criteria checklist (verify in your final take)

If a beat is missing, add it back before re-recording. The Loom must demonstrate, on camera:

**Open Data Track**
- [ ] Visual interface (the map and side panel — Demo 1)
- [ ] Real Texas public datasets (TWDB, EPA ECHO, USDM, USGS — name them by name in build cues 1.5 and 2.3)
- [ ] Attribution and accuracy discipline (citation chips, retrieval timestamps, "ECHO as proxy because TCEQ has no clean API" — the honest-accuracy line in 2.3)
- [ ] **Both technical deliverables** — MCP server *and* agent skill (called out explicitly in 2.7)
- [ ] Responsible-use posture (review-before-sending, never auto-submit, no private well-owner names — implicit in 2.8)

**Agents Track**
- [ ] Beyond a chatbot — the agent picks tools and decides what to surface (build cue 1.2)
- [ ] Real reasoning and tool use you can watch (the streaming reasoning trace — Demo 1 and 2)
- [ ] Cross-referencing / planning across multiple data sources (the tension flag — beat 2.4)
- [ ] Error handling / structured uncertainty (the caveats system — covered in failure-modes table; mention briefly only if a card surfaces a caveat live)
- [ ] Useful output a human can act on (the public comment artifact — beat 2.6)
- [ ] *Bonus signal:* the build itself used Codex + Claude Code in parallel — credible evidence of agent utility, named in Section 1

---

## Hero lines, isolated

If you forget everything else, land these four:

1. **Elevator pitch wedge:** *"The address-based tools you do know — First Street, EJScreen — stop where water supply begins."*
2. **Demo 2 tension:** *"It cross-referenced two things on its own — the aquifer is in decline, AND a 4.2 million-gallon-per-day permit was filed nearby in March. No human told it to put those side by side."*
3. **Demo 2 hand-off:** *"This is the moment Dryline stops being a tool and starts being an agent. Public data went in. A fileable civic action came out."*
4. **Closer:** *"Long-term, this becomes environmental due diligence for the state."*

---

## Camera-on discipline

- **Eyes to the camera lens, not the preview window.** This is the single biggest tell. Tape a sticky note next to the lens that says *LOOK HERE.*
- **Hands out of frame** for the elevator pitch (no nervous gestures). Hands optional once you're on screen-share.
- **Don't apologize for caveats live.** If the MCP times out on a card, point to the caveat badge and say *"every card shows data freshness — when something fails, the agent says so."* That's a feature.
- **Don't say "um."** Loom doesn't edit it out. Practice the elevator pitch out loud three times before the real take.
- **Don't read this script aloud.** Use it for shape, not language. The verbatim lines above are the only things that should sound exactly the same every take.

---

## Live-demo failure modes — and what to say

| If… | Do this | Say this |
|---|---|---|
| MCP tool times out on a card | Point at the caveat badge that says so | "Every card surfaces data freshness — when something fails, the agent says so. That's the contract." |
| Reasoning trace stalls | Wait two seconds. If still stalled, click into Actions to show the drafted artifact. | "While the agent finishes — here's what it produced last time we ran this address. Same shape." |
| Map fails to load tiles | Switch to the backup tab (pre-loaded successful run) | "Map tiles being slow — let me jump to a cached run so you can see the flow." |
| Address resolves wrong | Use the demo button | "Demo button is the safe path here." |
| You stumble on a hero line | Don't start over — recover. The line is short enough to redo on the fly. | *(re-deliver, slower, lower)* |

If anything fails *and* you can't recover, **stop the recording, take a breath, restart Loom from the top.** Loom Free has unlimited videos; you're only limited per-video.

---

## Cuts to make if you're running long

In order:

1. **Drop the Drought card narration in Demo 1** (Beat 1.4). Saves ~8s.
2. **Drop the second build-cue in Demo 2** (Beat 2.7 — "skill is portable…"). Saves ~12s.
3. **Compress the elevator pitch.** Drop the second sentence about who it's for. Saves ~10s.
4. **Drop Wimberley entirely.** Open with Taylor cold, framed as "I'll show you the heaviest case." Saves ~50s. Last resort.

Never cut: the wedge sentence in the elevator pitch, the cross-reference tension beat in Taylor, the public-comment artifact, or the closer.

---

## What this script is NOT

- **Not a verbatim line read.** Use the beats for shape; trust your knowledge of the project for the in-between.
- **Not a stage pitch.** Loom is intimate — one viewer at a time, often a judge alone at a desk. Talk to one person, not a room.
- **Not a tutorial.** You're showing what you built, not teaching the viewer to use it. Resist the urge to explain UI affordances they didn't ask about.
- **Not the in-person pitch.** `PITCH.md` and `DEMO.md` are for live judging; this is the recorded artifact. Different medium, different rhythm. Fewer slides, more face.

---

*Companions: [`PITCH.md`](./PITCH.md) (in-person 5-min slide pitch), [`DEMO.md`](./DEMO.md) (in-person 3-min live demo), [`LANDSCAPE.md`](./LANDSCAPE.md) (the wedge in full), [`PROPOSAL.md`](./PROPOSAL.md) (project thesis).*
