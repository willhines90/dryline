# Dryline
**Investigate Texas water at any address.**

*Environmental intelligence for a thirsty state.*

**Hackathon:** AITX × Codex Hackathon · May 8–10, 2026 · Antler ATX
**Tracks:** Brainforge / Vicinity Texas Open Data Track (primary) · Agents Track (secondary)
**Name:** Dryline — named for the meteorological boundary across West Texas where dry continental air meets moist Gulf air. The dryline is the line where Texas weather and Texas water meet, every day.
**Team:** Solo build; architecture split along `/mcp`, `/skill`, `/web` so a teammate joining mid-stream can take any one piece independently.
**Build tool:** Codex (hackathon sponsor — OpenAI's terminal-based agentic coding agent) · **Runtime agent:** OpenAI Responses API + MCP

---

## The pitch in one paragraph

Texas is water-stressed and getting more so — drought, aquifer depletion, population growth, and now hyperscale data centers and semiconductor fabs all draw from the same finite stack. The data exists across TWDB, USGS, TCEQ, EPA, GCDs, and TNRIS, but it's scattered across five sites that don't talk to each other. Dryline is a map-first environmental-intelligence layer that takes any Texas address and tells you what's happening with your water — for personal decisions ("will the water last here?") and for civic transparency ("who's drinking your aquifer?") — with an agent that autonomously investigates, cites every source, and drafts concrete actions like public comments and weekly briefings.

**The deeper framing.** Dryline isn't an investigation of a *place*. It's a way to see the *hidden systems* behind a place — the reservoir that feeds your utility, the utility that serves your county, the industrial permit drawing from your aquifer, the drought zone overlapping your growth corridor. Address-as-entry-point is the demo affordance; the underlying object the agent reasons over is a water dependency graph.

## Why this hits both tracks honestly, not stretched

**Open Data track.** Visual interface (map + dashboards), uses public Texas data with attribution, makes scattered data legible. Ships an MCP server *and* an agent skill — the brief explicitly says teams that ship both will be especially competitive.

**Agents track.** The product *is* an autonomous investigation loop: address in → multi-tool reasoning across 6+ sources → cross-referencing → synthesis with citations → drafted artifacts (public comment, GCD letter, scheduled briefing). The reasoning trace is visible in the UI so judges see the agent working.

The dual submission isn't repurposing — it's the same artifact viewed through two lenses, which is a stronger story than two separate entries would be.

## The two demo modes

**Personal mode — "Will the water last here?"**
Addresses a homeowner / homebuyer / well owner / mover. Surfaces drinking water quality and recent violations, current drought stage and what it forbids, reservoir trajectory if you're served by surface water, aquifer trajectory if you're on groundwater, flood exposure. Drafts: lawn-watering reminder, well-deepening assessment, "should I worry about my water bill" summary.

**Transparency mode — "Who's drinking your aquifer?"**
Addresses a journalist / activist / engaged citizen. Same investigation, different emphasis: large permitted users sharing your aquifer or watershed, recent permits with open public-comment windows, historical violations and complaints near you, GCD or TCEQ enforcement context. Drafts: a public comment for an open permit, a PIA request, a letter to the GCD board, a weekly briefing subscription.

The same agent runs the same investigation; only the synthesis prompt and the action-drafting branch differ. That's a feature, not extra work — it shows the agent making contextual judgment calls.

## Demo lineup — seven locations, three rehearsed for the live demo

### The live-demo trio (rehearsed, polished, three minutes)

**1. Wimberley, TX — Hill Country private well · Personal mode**
The story: Trinity Aquifer, recurring drought, ~50% of Wimberley homes on private wells, the Blanco River has gone dry in summer multiple times in recent years, Hays Trinity GCD has limited regulatory tools. The wow: the "weekend home" address — judges know it, judges have been there. Falling aquifer levels on a 20-year time series. *Drafted action:* Stage 4 watering rules summary + a "deepen your well?" cost estimate based on local driller data.

**2. Taylor, TX — Samsung's $17B semiconductor fab · Transparency mode**
The story: Samsung's fab in a town of 16,000 people draws several million gallons per day from Lake Granger and the Trinity Aquifer; active TCEQ permits; renegotiated water contract; ongoing local debate about Williamson County's water carrying capacity. The wow: this is the most-discussed industrial water user in Texas right now. The map shows the fab footprint, the lake it draws from, the aquifer beneath, and a list of comparable industrial water permits in the metro. *Drafted action — hero artifact:* a structured public comment for an open TCEQ permit, plus a one-pager comparing Samsung's draw to a typical Williamson County subdivision.

**3. Fort Stockton, TX — Comanche Springs · Transparency mode**
The story: Comanche Springs flowed for centuries until 1950s irrigation pumping from the Edwards-Trinity aquifer dried them up. The 1954 *Pecos County WCID v. Williams* case (a.k.a. *Belding*) cemented Texas's rule-of-capture doctrine. Modern echoes: ongoing fights over Republic Water's permit to ship Pecos County water to El Paso. The wow: the cautionary tale of Texas water — stream-flow graph that goes flat in 1955 and stays there. Drops jaws. Connects history to a live permit fight. *Drafted action:* a GCD board letter and a "what happened to Comanche Springs" briefing.

**Demo arc:** warm-up with Wimberley (personal, relatable), pivot to Taylor (transparency, news cycle), close with Fort Stockton (historical weight, sobering). Three minutes, three modes of impact.

### The cinematic investigation sequence (designed shot-by-shot)

The judges remember the investigation flow, not the dataset count. Optimize for this:

1. User enters address (or clicks pre-staged demo button)
2. Map flies to location with smooth zoom to parcel level
3. Reasoning trace begins streaming in a side rail — "Resolving location… Identifying watershed… Checking drought status…"
4. Result cards populate progressively as tools return — drinking water first (fastest), then drought, reservoirs, aquifer, big users
5. The agent flags a tension: *"Aquifer in decline AND a 4.2 MGD permit was filed nearby in March."* This is the moment the room goes quiet.
6. Synthesized summary appears with inline citations, mode-aware framing
7. Drafted action artifact slides in — public comment, GCD letter, or briefing — with visible "review before sending" affordance

Each step is observable. No black boxes. The agent works the way a careful researcher works, and you can see them work.

### Four more in the chamber (ready for follow-up questions)

**4. Houston Memorial neighborhood — Buffalo Bayou · Personal.** Harvey-zone flood exposure layered against drinking water (City of Houston PWS), Addicks/Barker reservoir release context, saltwater intrusion risk. *Drafted action:* flood-insurance prompt + reservoir release alert subscription.

**5. Lubbock, TX — Ogallala Aquifer · Transparency.** The canonical American aquifer-depletion story. Time series shows decades of decline; cotton irrigation as the named driver. *Drafted action:* county-water-plan summary + comparison to neighboring counties.

**6. El Paso, TX — Hueco Bolson + Kay Bailey Hutchison desalination plant · Personal.** A *positive* water story — largest inland desal plant in the U.S., Hueco Bolson management, treaty water from Mexico. Adds tonal variety. *Drafted action:* water-rate context for a homeowner.

**7. San Antonio — Edwards Aquifer recharge zone · Transparency.** Most-regulated aquifer in Texas, EAA permit caps, J-17 monitoring well as the public benchmark, ongoing growth pressure. *Drafted action:* comment on an open EAA permit + recharge-zone explainer.

### Geographic and story coverage

- *Hill Country:* Wimberley
- *Central / I-35 corridor:* Taylor, San Antonio
- *East / Coast:* Houston
- *West / Trans-Pecos:* Fort Stockton
- *Panhandle / High Plains:* Lubbock
- *Far West:* El Paso

Every major Texas water region except the Coastal Bend (Corpus Christi) and the Rio Grande Valley — those have great stories but need more careful framing than three minutes allow. They're listed in the README as "where Dryline goes next."

Pre-staged answers for all seven. Live tool calls so the reasoning trace is real, but the content is curated to land cleanly.

## Architecture

### MCP server: `dryline-mcp`

Eight bounded tools, all address-anchored, all returning `{ data, caveats[], sources[] }`:

- `resolve_location(address)` → lat/lng, county, FIPS, watershed (HUC-12), GCD, public water system ID
- `get_drought_status(address)` → current U.S. Drought Monitor category, governing utility's drought stage, allowed uses
- `get_reservoirs(address, radius_mi)` → live % full vs historical avg, trend, last updated
- `get_aquifer_status(address)` → aquifer name, monitoring well trend, decadal change
- `get_drinking_water(pws_or_address)` → PWS name, recent violations (SDWIS via ECHO), boil-water history
- `get_big_users_nearby(address, radius_mi)` → permitted high-volume users, type, MGD draw
- `get_active_permits(address, radius_mi, since)` → new water/discharge permits with comment deadlines
- `get_river_flow(address)` → nearest USGS gauge, current vs normal, trend

The `caveats` and `sources` fields are non-negotiable — they're how the agent stays responsible, and how judges see we took the brief's "thoughtful about accuracy, context, and responsible use" line seriously.

### Agent skill: `dryline-skill`

A SKILL.md plus a `references/` folder. Sections:

- **When to invoke each tool** — decision rubric mapping question types to tool sequences
- **How to combine results without overclaiming** — correlation vs causation; permitted ≠ polluting; data-freshness rules
- **Citation discipline** — every claim links back to its source URL with retrieval timestamp
- **Action-drafting rules** — when to draft a public comment, GCD letter, PIA request, or briefing; what each must include
- **Three worked examples** — one personal-mode, two transparency-mode, with full reasoning traces
- **Required disclaimers** — language for "this does not constitute legal/health advice"

Skill is portable. Any agent that loads it (Codex, Claude, custom OpenAI loop) gets the same investigation discipline. That's a meaningful contribution to the open ecosystem on its own.

### Web app

Next.js + MapLibre + shadcn/ui. Single page:

- Map with Texas basemap, drop-pin or address search
- Side panel of result cards: Drinking Water · Drought · Reservoirs · Aquifer · Big Users · Active Permits · Rivers
- "Investigate" button that runs the agent loop with a visible reasoning trace
- Mode toggle: Personal ↔ Transparency
- Actions tab: drafted artifacts (comment, letter, briefing) with copy-to-clipboard and "subscribe" buttons

### Agent investigation loop

User picks address → clicks Investigate → agent autonomously:

1. Resolves location, fetches drought, drinking water, reservoirs, aquifer, big users, active permits *in parallel*
2. Cross-references findings ("aquifer in decline AND new 4 MGD permit nearby" → flag)
3. Writes mode-appropriate synthesis with inline citations
4. Drops mode-appropriate action artifacts in the Actions panel

Reasoning trace is visible the whole time. That's the Agents-track entry, full stop.

### Hero artifact: the public-comment draft

Of all the action artifacts the agent produces, the public-comment draft for an open TCEQ permit does the most work in 30 seconds. It demonstrates, simultaneously: agent reasoning over fetched data, contextual understanding of what makes a comment effective, knowledge of Texas civic process (comment windows, who to address, what facts cite well), and concrete output the user could actually file. Polish this artifact first. The other artifacts (GCD letter, weekly briefing, watering reminder) are nice to have. The public comment is the moment the project stops being a "tool" and starts being an *agent*.

## Data sources — viability after the tire-kicking pass

| Source | What it gives us | Access | Verdict |
|---|---|---|---|
| **TWDB Water Data for Texas** | 122 major reservoirs, levels, storage, history | REST API ([waterdatafortexas.org](https://waterdatafortexas.org/)) | ✅ Live, easy |
| **U.S. Drought Monitor** | Weekly drought category by county/state/zone | REST API ([usdmdataservices.unl.edu](https://droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx)) + GeoJSON | ✅ Live, easy |
| **USGS NWIS Water Services** | 500+ Texas stream gauges, real-time + historical | REST API ([waterservices.usgs.gov](https://waterservices.usgs.gov/)) | ✅ Live, well-documented |
| **EPA SDWIS via ECHO** | Drinking water violations, public water systems | REST API + bulk download | ✅ Live; preferred over TCEQ DWW because ECHO has APIs |
| **TWDB GWDB (groundwater)** | ~140k wells, ~2k monitoring wells, levels, quality | Nightly pipe-delimited bulk files + shapefile | ⚠️ Snapshot — load into DuckDB at start |
| **TNRIS Floodplain Quilt** | Statewide cursory floodplain (2021) | Bulk download via DataHub + REST API for collections | ⚠️ Snapshot — pre-process for demo regions |
| **TNRIS Land Parcels (StratMap)** | County appraisal parcel geometry | DataHub bulk download | ⚠️ Snapshot — load demo counties only |
| **TCEQ permits / regulated entities** | Permits, violations, applicant histories | Web-form Central Registry; no clean public API | ⚠️ Use EPA ECHO as proxy for federal-reportable facilities; TCEQ-only data via PIA if needed |
| **GCD list & rules** | 100+ Groundwater Conservation Districts, varying rules | Mix of TWDB list + scraping individual GCD sites | ⚠️ Curate snapshot for demo districts |

Color summary: **5 live APIs** form the spine (reservoirs, drought, USGS, ECHO/SDWIS, plus geocoding). **4 snapshot sources** (groundwater wells, floodplain, parcels, GCD rules) get pre-loaded into DuckDB for demo regions. Nothing requires PIA on the critical path.

## Weekend schedule

**Friday evening (3–4 hr).** Scope lock; monorepo scaffold (`/mcp`, `/skill`, `/web`); demo addresses chosen; pre-load DuckDB with snapshot sources for demo regions.

**Saturday morning (4–5 hr).** MCP tools 1–3: `resolve_location`, `get_drought_status`, `get_reservoirs`. These three live APIs unlock half the demo.

**Saturday afternoon (4–5 hr).** MCP tools 4–6: `get_aquifer_status` (DuckDB), `get_drinking_water` (ECHO), `get_big_users_nearby` (ECHO). Tools 7–8 (`get_active_permits`, `get_river_flow`) if time permits.

**Saturday evening (3–4 hr).** Web app scaffold: map, side panel, mode toggle. SKILL.md draft.

**Sunday morning (3–4 hr).** Agent investigation loop with visible reasoning trace; action-drafting (comment, GCD letter, briefing); polish demo addresses.

**Sunday afternoon (2–3 hr).** Demo rehearsal, README with attribution, deploy (Vercel for web; Railway/Render/Fly for MCP).

## Fallback: the minimum viable winning version

If anything slips, this is what ships. Anything beyond it is gravy.

**MCP tools (5 only):** `resolve_location`, `get_drought_status`, `get_reservoirs`, `get_drinking_water`, `get_big_users_nearby`.

**UI:** map, side panel, reasoning trace. No mode toggle — pick personal mode for v1.

**Agent outputs:** synthesized summary + one drafted artifact (the public comment).

**Demo addresses:** two — Wimberley (warm-up) and Taylor (close).

This MVP would still beat the median entry because the *flow* — visible reasoning, cited synthesis, drafted action — is the differentiator. Number of tools, datasets, and addresses is not what wins. Cinematic investigation flow is what wins.

## Scope cuts already locked

- **Skip LiDAR.** The floodplain GeoJSON layer covers demo needs; LiDAR rendering is a rabbit hole.
- **Demo regions, not all of Texas.** Pre-load snapshot data only for the seven demo addresses' counties. Architect for statewide, ship for seven.
- **Drop air quality and emissions.** Stay water-anchored. The only environmental-not-water data we use is regulated-facility lookup, and only because facilities are water permittees.
- **No user accounts.** Subscribe-to-briefing button stores email for later; no auth, no login.
- **Mapbox-free.** MapLibre + open tiles to avoid token hassles in deployment.

## What NOT to spend time on

The classic ambitious-builder failure mode is polishing the wrong things. Explicit no-go list:

- **Don't perfect GIS layer styling.** Reservoir blue is fine; the contour-line aesthetic is a bonus, not a blocker.
- **Don't integrate every available dataset.** Eight tools is the ceiling, five is the floor. Resist scope creep.
- **Don't over-engineer the deploy infra.** Vercel + a single MCP host. No Kubernetes, no custom CI.
- **Don't build a beautiful settings page.** No settings page at all.
- **Don't gold-plate the typography.** Default shadcn looks good enough.
- **Don't chase TCEQ data through PIA.** ECHO is the proxy. Punt the rest to README "future work."
- **Don't write more than three worked examples in SKILL.md.** Three is enough to demonstrate discipline.
- **Don't build a chat interface.** The "Investigate" button + reasoning trace is the interaction. A chat box is a fallback you don't need if the investigation flow is good.

Judges remember the investigation flow, the narrative, the reasoning trace, and the drafted artifacts. That's the soul. Everything else is wasted polish.

## Risks and mitigations

- **TCEQ data is form-driven.** *Mitigation:* use EPA ECHO as proxy; flag TCEQ-only items as future work in the README.
- **Snapshot freshness.** *Mitigation:* show retrieval timestamp in every card; the `caveats` field includes "data as of YYYY-MM-DD."
- **Geocoding cost / accuracy.** *Mitigation:* Nominatim free tier for the demo; document Mapbox migration path.
- **Agent overclaiming.** *Mitigation:* SKILL.md explicitly forbids causation language and personal-impact predictions; outputs include disclaimers.
- **Privacy of named individuals in well/water-rights data.** *Mitigation:* never surface owner names in UI; only aggregate or facility-level entities. Mention this restraint in the README.

## Brand & positioning

**Positioning:** Environmental intelligence, not civic dashboard. The product is analytical, infrastructural, spatial — closer to a Bloomberg terminal for Texas water than to an open-data portal. Judges have seen a hundred ChatGPT-for-public-data entries; what they haven't seen is a serious investigation tool with visible reasoning and drafted artifacts.

**Tagline system.** Three taglines, three contexts:

- **Primary (hero, demo, README):** *Investigate Texas water at any address.* — direct, demo-friendly, anchors Dryline to water in 30ms.
- **Secondary (narrative, marketing, blog):** *The line between you and your water.* — reframes the dryline metaphor as the gap between people and what they know about their water.
- **Tertiary (captions, social, Easter-eggs):** *Texas water, line by line.* — wordplay on Dryline + the citation-by-citation way the agent investigates.

**Voice.** Quietly intelligent. Spare. Concrete. Cites everything. Never dramatizes risk. The agent reads like a careful field researcher, not a chatbot.

**Aesthetic direction.** Topographic. Map-first. Contour lines as a recurring motif. Reservoir blues against arid earth tones. Animated drought gradients. Atmospheric layering — a real dryline crossing the state on the landing page hero. Skip the bright civic-tech blue-and-orange palette; it telegraphs "government website."

## Naming — verified shortlist

**Chosen:** **Dryline.** A dryline is the meteorological boundary across West Texas where dry continental air meets moist Gulf air — the line that drives Texas drought and storm cycles. The name *is* the topic. Sharp, memorable, product-shaped. Conflict landscape is clean: only adjacency is Dry Line Partners, an Austin-based PE firm in a different category.

**Considered and verified clean:** Llano (Texas river/region; no software conflicts), Acequia (Spanish/Indigenous communal-irrigation tradition; clean but requires "in tribute" framing), Headgate (irrigation control point; clean but less obvious as a product), Caliche (distinctly Texan; only conflict is unrelated Indian biotech firm).

**Considered and dropped:** Watershed (taken — Watershed.com is a $100M Series C climate-data company, direct adjacency), Pecos (multiple existing software products), Aquifer (too groundwater-specific), Source (too generic), Headwaters (mouthful), Arroyo (common Spanish word, hard to own).

## Resolved decisions

- **Name:** Dryline (above)
- **Build tool:** Codex (hackathon sponsor; OpenAI's terminal-based agentic coding agent)
- **Runtime agent:** OpenAI Responses API + MCP — Codex is a developer tool, not a production runtime, so these are different layers, not a contradiction
- **Team posture:** Solo build, with the repo split cleanly along `/mcp`, `/skill`, `/web` so a teammate joining mid-stream can pick up any one piece without stepping on the others

## Open questions

1. **Specific street addresses** for the seven locations — pick at scaffold time when we want fixtures (the city/region is locked, the literal lat/lng can wait).
2. **MCP hosting** — Vercel for web is locked; MCP host is Railway / Render / Fly — defer until Sunday morning.

## Attribution and responsible use

All data is public, accessed via official channels, with sources cited per response. No scraping behind authentication. No surfacing of private well-owner or water-rights-holder names. Caveats channel exposes data freshness and known limitations on every card. Action drafts include "this is a draft, review before sending" notices. Repository is open source under permissive license; SKILL.md and MCP server are reusable independent of the web app.

---

*Last updated: May 9, 2026 (Saturday — build day). This proposal will be revised as the build progresses; check git history for diffs.*
