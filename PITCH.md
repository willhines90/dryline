# Dryline — Pitch Narrative

**Slot:** 5 minutes total · ~90s narrative → ~3 min live demo → ~30s close
**Audience:** AITX × Codex Hackathon judges (Brainforge / Vicinity Texas Open Data Track + Agents Track)
**Voice:** Quietly intelligent. Spare. Concrete. Cites everything. Never dramatizes.

---

## Slide 1 — Title (10s)

**Visual:** Map of Texas at dusk. A real dryline crosses the state from the Panhandle down to Del Rio — moist Gulf air to the east, dry continental air to the west. The line glows faintly. The wordmark "Dryline" sits in the lower left.

**Sub-headline:** *Investigate Texas water at any address.*

**Spoken:**
> "Texas added 4 million people in five years. Our water didn't keep up. A dryline is the meteorological line across Texas where Gulf air meets continental air. We named our project after it."

---

## Slide 2 — The problem (20s)

**Visual:** Five logos arranged like islands — TWDB, USGS, EPA SDWIS, TCEQ, TNRIS — with no connecting lines between them. A small icon of a person stands off to the side, looking at all of them.

**Headline:** *Texas water data exists. It just doesn't talk to itself.*

**Spoken:**
> "Texas is water-stressed and getting worse — drought, aquifer depletion, population growth, and now hyperscale data centers and semiconductor fabs all drawing from the same finite stack. The data exists across TWDB, USGS, TCEQ, EPA, and TNRIS. But it's scattered across five sites that don't talk to each other. If you want to know what's happening with the water at *your* address, there's no one place to look."

---

## Slide 3 — The insight (15s)

**Visual:** A single address pin in the center of the screen. From it, lines fan out to cards labeled "Reservoir," "Aquifer," "Drought," "Public Water System," "Permits," "Big Users." The graph reorganizes itself as the lines settle.

**Headline:** *An address is a doorway into a dependency graph.*

**Spoken:**
> "The thing we want to investigate isn't really the address. It's the hidden system *behind* the address — the reservoir that feeds your utility, the utility that serves your county, the industrial permit drawing from your aquifer, the drought zone overlapping your growth corridor. Address-as-entry-point is the demo affordance. The underlying object the agent reasons over is a water dependency graph."

---

## Slide 4 — What Dryline is (15s)

**Visual:** Three-pane diagram. Map (left) → reasoning trace streaming (center) → drafted public-comment artifact (right). A subtle arrow connects the panes.

**Headline:** *Map-first investigation. Visible reasoning. Drafted civic action.*

**Spoken:**
> "Type any Texas address. An agent autonomously investigates the water situation around that location, cross-references findings across six-plus public datasets, and produces a synthesized summary with inline citations — and a drafted action artifact: a public comment, a GCD letter, or a weekly briefing. You see the agent work. Every claim links back to its source."

---

## Slide 5 — Two modes, one investigation (10s)

**Visual:** Split panel — same Texas map, two different side rails. Left: warm Personal-mode card ("Will the water last here?"). Right: cooler Transparency-mode card ("Who's drinking your aquifer?").

**Headline:** *Personal · Transparency*

**Spoken:**
> "Same investigation, two framings. Personal mode for the homeowner, the well owner, the person thinking about moving. Transparency mode for the journalist, the activist, the engaged citizen. The agent runs the same tools — it just makes different judgment calls about what to surface and what action to draft."

---

## Slide 6 — How it's built (15s)

**Visual:** Three boxes — `mcp/` `skill/` `web/` — sitting on top of a row of 8 dataset logos. Above them, a banner: "OpenAI Responses API + MCP. Built with Codex."

**Headline:** *MCP server + agent skill + map-first web app.*

**Spoken:**
> "Three pieces. An MCP server with six bounded tools, every one returning data, caveats, and sources. A portable agent skill — a SKILL.md plus references — that any compliant agent can load to get the same investigation discipline. And a Next.js + MapLibre web app that makes the reasoning trace cinematic. The brief said teams that ship both an MCP server *and* a skill are especially competitive. We shipped both."

---

## Slide 7 — Live demo (handoff, 5s)

**Visual:** Just the wordmark, a soft contour-line motif, and the line *"Three addresses. Three modes of impact."*

**Spoken:**
> "Let me show you."

> *[Switch to live product. See `DEMO.md` for the demo script.]*

---

## Slide 8 — What we shipped, against the criteria (20s)

*Use this slide ONLY if there's time after the demo. If not, the demo carries this weight on its own.*

**Visual:** Four stacked rows, each one criterion + a one-line answer.

| Judging criterion | Dryline |
|---|---|
| **Technical execution** | MCP server (6 tools), portable agent skill, Next.js map app. 5 live APIs + 1 curated snapshot (TWDB GWDB). |
| **Partner ecosystem** | Built with Codex. Runtime on OpenAI Responses API + MCP. Shipped against both required deliverables in the brief. |
| **Value & impact** | Two modes, two real users — homeowner and citizen. Hero artifact is a fileable public comment on a live TCEQ permit. |
| **Innovation** | Visible agent reasoning over a water *dependency graph*, not a flat dataset. Citations are first-class. Action drafts close the loop from data to civic process. |

**Spoken (only if needed):**
> "Six tools, two modes, three rehearsed addresses, every claim cited. The full architecture — MCP, skill, web — is open source and on GitHub now."

---

## Slide 9 — Open source · what's next (10s)

**Visual:** GitHub URL + MIT license badge + a Texas map shaded to show the seven demo regions. Two blank regions — Coastal Bend and Rio Grande Valley — pulse softly with a "next" tag.

**Headline:** *MIT-licensed. The skill is portable. The MCP server is yours.*

**Spoken:**
> "Everything is open source under MIT. The agent skill is portable to any MCP-compatible runtime — Codex, Claude, your own loop. We've covered seven Texas water regions; Coastal Bend and the Rio Grande Valley are the obvious next two. Long-term, this becomes environmental due diligence for the state."

---

## Slide 10 — Close (10s)

**Visual:** Return to the dusk map of Texas with the dryline glowing. The wordmark fades up. Beneath it, the tagline rotates from *Investigate Texas water at any address* to *The line between you and your water*.

**Spoken:**
> "Texas water is the story of this decade in this state. Dryline gives you a way to read it, line by line. Thanks."

---

## Pacing notes

- **0:00–1:30** — slides 1 through 6. Move briskly; do not linger on slide 2 (problem statement). The audience already believes this.
- **1:30–4:30** — live demo (Wimberley → Taylor → Fort Stockton).
- **4:30–5:00** — slide 8 *or* skip to slide 9 + slide 10. Pick on the day based on how the demo lands.

## What to cut if you're running long

1. Slide 8 — the demo already proved each criterion.
2. Slide 5 — the mode toggle is visible in the live demo.
3. The Fort Stockton demo address — keep Wimberley + Taylor only.

## What to never cut

1. The Comanche Springs flatline reveal in the Fort Stockton demo. It's the moment the room goes quiet.
2. The "tension" beat in the Taylor demo where the agent surfaces the open TCEQ permit.
3. The closing line. Land it.

---

*Companion: see `DEMO.md` for the live-demo beat sheet.*
