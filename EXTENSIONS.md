# Dryline — Extensions Roadmap

*The product roadmap, now that Dryline is live. Scope: what to build on top of the shipped tool. `PROPOSAL.md` (local-only) holds the original thesis; `LANDSCAPE.md` the competitive analysis.*

---

## How to read this doc

Today Dryline is a **diagnostic** tool: address in → cited synthesis + drafted public comment out. This roadmap is about extending it along three axes:

1. **Diagnostic → prescriptive.** Today Dryline tells you what's happening; tomorrow it tells you what to *do* about it (Resilience Plan, Rebate Finder).
2. **Reactive → proactive.** Today users come to Dryline; tomorrow Dryline comes to users (Permit Watcher, Newsletter).
3. **Address → graph.** Today the entry point is a pin; tomorrow it's any node in the water dependency graph — watershed, aquifer, industrial actor (Graph Entry Points, Portfolio Mode).

Forecasting (Aquifer Forecaster, Resilience Score) and adjacent-domain expansion (Adjacent Layers) sit on top of all three.

**Competitive context.** Every extension below was scored against the wedge documented in [`LANDSCAPE.md`](./LANDSCAPE.md): does it widen the gap between Dryline and the closest analog (First Street / Risk Factor for address-based scoring; TWDB dashboards for Texas water in aggregate), or does it commoditize the project? The Water Resilience Score (P2) and Portfolio Mode (P4) score especially well precisely because no climate-risk-score company covers water supply at parcel level — that's the open lane.

---

## Rubric

Six criteria, each scored 1–5 (5 = strongest). Weights reflect post-hackathon priorities: demo-able first (because that's what wins users and follow-on funding), but with real revenue and moat weight so we're not just chasing demo gold.

| Criterion | Weight | 5 means | 1 means |
|---|---|---|---|
| **Demo Impact** | ×3 | Visual, surprising, room-quieting in 30 seconds | Ships in a settings menu |
| **Build Effort** *(inverted)* | ×2 | Days. Solo, evenings | Multiple months. Needs a team |
| **Data / API Feasibility** | ×2 | Open, clean, REST APIs exist | Locked behind PIA, scraping, or proprietary licenses |
| **Strategic Moat** | ×2 | Hard to copy; compounds over time | Anyone can build it in a weekend |
| **Architectural Fit** | ×1 | Drops cleanly into `mcp/skill/web` split | Needs new infra layer (queues, ML pipeline, etc.) |
| **Path to Use / Revenue** | ×2 | Clear customer, clear distribution | Speculative audience, no revenue model |

**Max score: 60.** Tiers: **A** ≥ 50 · **B** 44–49 · **C** ≤ 43.

A note on weighting: I deliberately did *not* weight Architectural Fit highly because the existing `mcp/skill/web` split is intentionally permissive — almost everything fits, so it's a weak discriminator. Demo Impact is weighted heaviest because Dryline's whole hackathon thesis is that the *flow* is the moat, and that thesis should govern post-hackathon work too.

---

## Ranked summary

| # | Proposal | Demo | Effort | Data | Moat | Fit | Path | **Total** | Tier |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | **Resilience Plan** (street-view → property actions) | 5 | 3 | 4 | 4 | 5 | 5 | **52** | A |
| 2 | **Water Resilience Score** (single property number) | 4 | 3 | 5 | 4 | 5 | 5 | **51** | A |
| 3 | **Per-Address Newsletter** (auto weekly briefing) | 3 | 5 | 5 | 3 | 5 | 5 | **50** | A |
| 4 | **Portfolio Mode** (bulk addresses, B2B dashboard) | 3 | 4 | 5 | 3 | 5 | 5 | **48** | B |
| 5 | **Permit Watcher** (subscribe → drafted comment) | 4 | 4 | 2 | 5 | 4 | 4 | **46** | B |
| 5 | **Aquifer Forecaster** (5/10/20 yr projections) | 5 | 2 | 3 | 5 | 3 | 4 | **46** | B |
| 5 | **Graph Entry Points** (watershed/aquifer/actor pages) | 3 | 4 | 5 | 3 | 5 | 4 | **46** | B |
| 8 | **Rebate Finder** (TX utility programs db) | 3 | 5 | 3 | 3 | 5 | 4 | **44** | B |
| 9 | **Adjacent Layers** (air, wildfire, heat, grid…) | 3 | 1 | 3 | 4 | 5 | 4 | **38** | C |

Plus a "demo accents" appendix (Time Machine, Sankey, Voice Mode, AR Property) — not ranked because they're features, not products.

---

## P1 — Resilience Plan · *Tier A · 52*

**Pitch.** Pin an address, see your property from above and from the street, and get a specific, costed, rebate-aware list of water-resilience interventions ranked by gallons saved per dollar.

### What it adds to Dryline

Dryline today is *diagnostic* — it tells you the aquifer is stressed and Stage 4 watering rules are in effect. It does not tell the homeowner what to actually *do*. The Resilience Plan closes that loop. It's also Personal mode's hero artifact, equal in weight to Transparency mode's public-comment draft.

### Build pieces

- **New MCP tool: `analyze_property_imagery(address)`** — fetches street-view + aerial; passes to a vision model; returns structured JSON: `{roof_sqft, lawn_sqft, impervious_sqft, downspout_locations, existing_xeriscape, gutter_present}` plus caveats and image source URLs.
- **New MCP tool: `get_local_water_rules(address)`** — drought stage, watering days, turf-grass caps (e.g., El Paso city code limits turf to 50%), permit requirements for cisterns. Returns rule citations.
- **New MCP tool: `get_rebates(address)`** — wraps the Rebate Finder (P8). Returns eligible programs with $-figures.
- **Skill update.** A new section in SKILL.md: "Drafting a Resilience Plan." Three worked examples — Wimberley well-owner, Austin tract-home, El Paso desert lot. Required disclaimers ("estimates only; verify with a licensed contractor").
- **Web.** New "Plan" tab adjacent to current Actions tab. Side-by-side: aerial photo with overlay polygons, ranked intervention cards (cistern $X, permeable pavers $Y, turf replacement $Z), each linking to the rebate program and a "find a contractor" stub.

### Data dependencies

| Source | Access | Cost / risk |
|---|---|---|
| **USDA NAIP aerial imagery** | USGS National Map ArcGIS REST + Google Earth Engine | Free, public domain. 0.6m resolution (0.3m on coastal states). Plenty for parcel-level rooftop / driveway / lawn segmentation. |
| **Mapillary** street-level | Free API, CC BY-SA 4.0 | Coverage uneven outside major cities — a real risk for rural Hill Country. |
| **Google Street View Static API** | $0.007/image pay-as-you-go (volume tier $0.0056) | Best coverage, but commercial cost. Use as fallback when Mapillary is empty. |
| **TX rainfall normals** | NOAA Atlas 14 / PRISM | Free. Needed to convert "1500 gal cistern off 1800 sqft south roof" into "captures ~X gallons/yr." |
| **Utility rebate programs** | Web scraping (no aggregator exists) | This is the Rebate Finder dependency — a moat opportunity, see P8. |
| **Vision model** | Claude / Gemini | Both can do impervious-surface segmentation at usable accuracy. Roboflow's solar-roof measurement is a known reference implementation. |

### Risks

- **Vision accuracy.** Boundary errors on lawn/driveway can swing dollar estimates. Mitigation: show the segmentation overlay and let the user nudge polygon edges; mark estimates as ranges, not points.
- **Rural street view gaps.** Mapillary won't cover every Hill Country well lot. Mitigation: aerial-only mode when no street view exists; degrade gracefully.
- **Liability.** Engineering recommendations (cistern sizing, drainage) without a licensed engineer is a real exposure. Mitigation: explicit "estimates for planning, not construction" framing, plus a "find a TX-licensed contractor" hand-off.
- **Vendor lock-in on Google.** Mitigate by building the vision pipeline against NAIP + Mapillary first; treat Google Street View as a coverage-completeness fallback we can swap.

### Demo moment

Aerial photo of the demo property fades in. Polygons trace themselves over impervious driveway, roof, lawn. Numbers spawn next to each: "580 sqft impervious driveway." Three intervention cards slide in: "Permeable pavers — captures 8,400 gal/yr — $X — eligible for $Y SAWS rebate." User clicks one and a draft contractor inquiry generates. Same architectural feel as the public-comment artifact, applied to the home instead of the permit.

### Score

| | | |
|---|---|---|
| Demo Impact | 5 | The visual itself is novel; "watch your property be analyzed" is shareable. |
| Build Effort | 3 | Vision pipeline + new MCP tools + new UI panel = real engineering, but no unknown unknowns. |
| Data Feasibility | 4 | NAIP and Mapillary are free; rebate scraping is the only sticky bit. |
| Strategic Moat | 4 | Combining vision + civic-rule lookup + rebate matching is a hard quartet to assemble; not a weekend clone. |
| Architectural Fit | 5 | Three clean new MCP tools + skill section + UI tab. |
| Path to Use | 5 | Direct homeowner value; affiliate / contractor referrals; rebate-eligible product upsell. |

---

## P2 — Water Resilience Score · *Tier A · 51*

**Pitch.** A single 1–100 number for any TX property — the Walk Score / Flood Factor of TX water. Embed it in real estate, lending, and insurance workflows.

### What it adds to Dryline

A score is a Trojan horse. It turns the dependency graph into something a non-expert can react to in one second, and it's the unit of distribution for Zillow / MLS / lender / insurer integrations. First Street Foundation's Flood Factor is the precedent — a single number, embedded into Realtor.com and Redfin, that became a default disclosure surface for a whole category of risk. Nobody has the equivalent for *water supply*.

### Build pieces

- **New MCP tool: `compute_resilience_score(address)`** — composes existing tools (`get_drought_status`, `get_aquifer_status`, `get_drinking_water`, `get_reservoirs`, `get_big_users_nearby`) into a weighted score with a public methodology page.
- **Methodology doc.** Public, citable, peer-review-able. The brand and credibility live here. First Street's methodology page is a useful template.
- **Web.** Score appears as a hero element on the address page; tapping it opens a "score breakdown" view showing each contributing factor and its weight.
- **Embeddable widget.** A `<script>` snippet brokers / lenders / journalists can drop on any page. This is the distribution play.

### Data dependencies

Pure synthesis. No new data — every input already exists in Dryline's MCP tools. The work is methodology, not data acquisition.

### Risks

- **Scoring credibility.** Bloomberg ran a piece in late 2025 on the limits of climate-risk scoring, and Zillow notably pulled climate scores from listings. A new score lands in a skeptical market. Mitigation: aggressive transparency (every score component cited and modifiable in the methodology), and frame as TX-specific where the data is genuinely better than national averages.
- **Methodology bikeshedding.** Hydrologists will argue the weights forever. Mitigation: ship v0 fast, publish the methodology as a versioned doc, treat criticism as inputs to v1.
- **Insurance/lending compliance.** If used in underwriting, FCRA-adjacent obligations may apply. Defer that integration; start with informational embeds.

### Demo moment

The address page now has a single big number — `Water Resilience Score: 47 / 100`. Click it. Hero unfurls into a horizontal bar showing six contributing factors, each citable. The methodology link is right there. Compare-mode lets you toggle the demo addresses against each other: Taylor scores 38, Wimberley 52, El Paso 71 (yes, El Paso scores well — desal + treaty water + aggressive conservation; that's a teachable surprise).

### Score

| | | |
|---|---|---|
| Demo Impact | 4 | Number-go-down is a known meme. Compare-mode is the real demo. |
| Build Effort | 3 | Methodology design takes thought; implementation is light. |
| Data Feasibility | 5 | All inputs already exist. |
| Strategic Moat | 4 | The brand of *the* TX water score is a durable position if claimed first. |
| Architectural Fit | 5 | Pure composition layer. |
| Path to Use | 5 | Brokers, lenders, insurers, MLS, Zillow integration story. Plus journalist citations. |

---

## P3 — Per-Address Newsletter · *Tier A · 50*

**Pitch.** Subscribe an address. Every Sunday, get a one-page briefing of what changed about your water this week — drought stage, reservoir levels, new permits nearby, violations issued. Ten lines, fully cited, agent-generated.

### What it adds to Dryline

A growth loop. Today Dryline is one-shot: investigate, get answer, leave. The newsletter creates returning attention and an email list that becomes the distribution channel for everything else (Resilience Plan upsells, Permit Watcher alerts, paid tier). The newsletter is also a journalist tool — a watershed-or-county subscription gives reporters a weekly story prompt.

### Build pieces

- **Scheduled job.** Weekly cron per subscriber. Runs the same agent investigation Dryline already runs, with a "what changed since last week" framing.
- **Diff layer.** A small store of last-run results per subscription so the agent can highlight deltas, not re-summarize state.
- **Email service.** Resend / Postmark / Loops. Solved problem.
- **Subscribe form.** Already in PROPOSAL.md scope as the briefing button.

### Data dependencies

Same as today's Dryline. No new sources.

### Risks

- **Cost per subscriber per week.** Multiple LLM calls × weekly × N subscribers can become real money fast. Mitigation: cache the tool results across subscribers in the same county/watershed; the *synthesis* is per-subscriber but the data fetches are not.
- **Email deliverability / spam folder.** Standard hygiene applies.
- **Content fatigue.** If the same county had no real changes, the briefing reads like filler. Mitigation: skip-empty rule with an honest "no significant changes this week" line and an estimated next-update date.

### Demo moment

Open a subscriber's inbox at 8am Sunday. The briefing is short, opinionated, dated, and cites every claim. "Lake Travis dropped 0.4 ft. New TCEQ permit filed in your watershed Tuesday — public comment open until June 14, draft attached." Click the draft, it's already written.

### Score

| | | |
|---|---|---|
| Demo Impact | 3 | Email-in-inbox isn't visual but the *content* is. |
| Build Effort | 5 | Scheduler + email + reuse of existing agent. |
| Data Feasibility | 5 | Same tools as today. |
| Strategic Moat | 3 | The compounding distribution channel is the moat, not the tech. |
| Architectural Fit | 5 | Drops in cleanly. |
| Path to Use | 5 | Free tier → paid tier → enterprise watershed monitoring. |

---

## P4 — Portfolio Mode · *Tier B · 48*

**Pitch.** Drop a CSV of 200 addresses, get a ranked water-risk dashboard with deep-dive on each. For real-estate investors, school districts, retail chains, university systems, ranchers managing multiple parcels.

### What it adds to Dryline

The first concrete B2B revenue line. Personal mode is freemium / consumer; Transparency mode is journalist / advocacy (worth keeping free for distribution); Portfolio mode is the paid B2B tier.

### Build pieces

- **Bulk upload UI.** CSV / Excel parser; column mapping; geocoding pipeline.
- **Fanout investigation.** Run the agent loop across N addresses with parallelism + rate-limiting.
- **Dashboard.** Sortable / filterable table with the Resilience Score (P2) as the default sort; per-row drill-down to the existing single-address view.
- **Export.** PDF / xlsx report for the analyst's client / board.

### Data dependencies

Same as core Dryline. The work is engineering throughput, not data acquisition.

### Risks

- **Geocoding cost** at portfolio scale. Negotiate with a geocoder vendor or batch through Nominatim with care.
- **Competitor space is occupied.** Telescope ($4M seed, March 2025) is doing AI portfolio risk for sustainability factors (wildfire, flood, soil, biodiversity). ClimateCheck and First Street do flood + climate. *None* of them go deep on water *supply* — aquifer drawdown, big users, drought, drinking-water violations. That's Dryline's wedge. Lead with TX water depth; expand only after the wedge holds.

### Demo moment

Real-estate investor uploads 47 multifamily addresses. Bar in the dashboard fills as Dryline investigates each. Top of the list: an east-Austin building with a flagged drinking-water violation history. Bottom: a San Antonio property in EAA recharge zone with a stable Resilience Score. Investor clicks "generate board report," gets a 12-page PDF with maps, tables, citations.

### Score

| | | |
|---|---|---|
| Demo Impact | 3 | Less arresting in 3 min, but a clear B2B story. |
| Build Effort | 4 | Mostly throughput engineering. |
| Data Feasibility | 5 | Same data. |
| Strategic Moat | 3 | Crowded competitive set, but TX-water depth is real. |
| Architectural Fit | 5 | Natural extension. |
| Path to Use | 5 | Direct B2B revenue: REITs, school districts, retail chains, university systems. |

---

## P5 — Permit Watcher · *Tier B · 46*

**Pitch.** Subscribe a watershed, aquifer, or zip. When a TCEQ permit drops, you get an email within 24 hours with a Dryline-drafted public comment ready to review and file. Pre-permitting civic infrastructure for the journalist / activist / engaged citizen.

### What it adds to Dryline

Today's Dryline drafts a comment when you investigate. Permit Watcher inverts the loop: it watches the permits *for* you and brings the draft. That's the difference between a tool and a service. Same skill, same drafting logic, just running on a schedule against a live watch list.

### Build pieces

- **Permit ingest.** TCEQ has no RSS or API for pending permits — the Commissioners' Integrated Database is web-search only. We need a daily scraper of the public-notice surfaces (Pending Air, Water Quality, MSW notice pages) plus the Chief Clerk public-notice search. Normalize into a structured permit feed.
- **Watch-list matcher.** Subscribers register filters (watershed, county, aquifer, "anything within 5 mi of address"). Matcher fans new permits to subscribers.
- **Drafting pipeline.** Existing skill + a permit-specific synthesis prompt.
- **Notification.** Email + an in-app inbox.

### Data dependencies

| Source | Access | Difficulty |
|---|---|---|
| **TCEQ Pending Permits** (air, water-quality, waste) | Web pages, no API | Manual scrape; brittle but tractable |
| **TCEQ Chief Clerk public-notice search** | Web form | Same |
| **EPA ECHO permit feeds** | REST API | Easy; partial coverage of TCEQ-only items |

### Risks

- **TCEQ scraping fragility.** Their pages change without notice. Mitigation: alert on parser failure; manual review queue; treat ECHO as fallback for federal-reportable items.
- **False positives in the watch list.** A permit "near" you that turns out to be a routine renewal is annoying. Mitigation: classify each permit (new / renewal / minor amendment) before notifying, and let users tune sensitivity.
- **Civic anti-pattern risk.** A flood of templated comments gets devalued by TCEQ. Mitigation: SKILL.md drafts the comment as a *starting point* and surfaces the specific facts the user is best positioned to add. The agent's job is to write the boilerplate; the citizen's job is to make it specific.

### Demo moment

Three weeks ago you subscribed your county. Today your inbox: "New TCEQ permit filed Wednesday — Reagan Industrial Services, 2.4 MGD groundwater withdrawal in Fayette County. Comment window closes June 28. Draft attached, citing the Carrizo-Wilcox monitoring well decline you'd previously reviewed." That's the moment.

### Score

| | | |
|---|---|---|
| Demo Impact | 4 | Inbox demo is solid; the "drafted comment lands while you sleep" moment lands. |
| Build Effort | 4 | Most of the cost is the scraper, which is bounded work. |
| Data Feasibility | 2 | TCEQ has no public API — scraping is the only path. |
| Strategic Moat | 5 | Whoever does this *systematically* first owns the civic data layer for TX water. ETL is the moat. |
| Architectural Fit | 4 | Adds scheduler + scraper, which Dryline doesn't have today. |
| Path to Use | 4 | Sierra Club, Public Citizen, journalists, NGOs, Hill Country Alliance, Save Barton Springs Assoc. Real audiences with budgets. |

---

## P5 (tie) — Aquifer Forecaster · *Tier B · 46*

**Pitch.** Today Dryline shows your aquifer's recent trend. The Forecaster projects it forward 5/10/20 years given the current permit pipeline and a chosen climate scenario, and runs counterfactuals: "if a Samsung-sized industrial user permits in your county, here's how the math shifts."

### What it adds to Dryline

The Comanche Springs demo is the *historical* version of this story. The Forecaster is the *forward* version — same arc, but pointed at the Trinity, Edwards-Trinity, Carrizo-Wilcox, Ogallala, and Gulf Coast aquifers we'd otherwise show in static-trend mode. It's the most viscerally important extension: "your aquifer hits zero in 2042" is the only sentence here that gets policymakers to act.

### Build pieces

- **Wrap TWDB GAMs.** TWDB publishes Groundwater Availability Models (MODFLOW-based) for every major TX aquifer — Edwards/Trinity, Gulf Coast, Carrizo-Wilcox, Ogallala, Dockum, West Texas Bolsons. They're designed for 50-year planning horizons and TX law requires GCDs and regional planners to use them. We don't *re-build* the models; we wrap them.
- **MCP tool: `project_aquifer(address, scenario, horizon_yrs)`** — selects the right GAM, runs (or pre-computes) trajectories under named scenarios (BAU, RCP 4.5, RCP 8.5, "drought-of-record"), returns a time series.
- **MCP tool: `counterfactual_user(address, mgd, location)`** — adds a hypothetical user to the GAM run; returns delta vs baseline.
- **Web.** Time-series chart with scenario toggle and "add a user" button.

### Data dependencies

| Source | Access | Difficulty |
|---|---|---|
| **TWDB GAMs (MODFLOW)** | Free downloads + reports | Open data, but using them well requires hydrogeology expertise — INTERA has been the major contractor |
| **Climate scenario inputs** | NOAA, NCAR | Free |

### Risks

- **MODFLOW is heavy.** Running it live per-request isn't viable. Mitigation: pre-compute scenario trajectories per aquifer × climate path × pumping path, store in DuckDB, look up by address. Counterfactuals run only the perturbation, not the full model. Even simpler v0: regress historical observed trends against permit pipeline to produce a *statistical* (not physical) projection, marked clearly as such.
- **Overclaiming.** Hydrogeologists will (correctly) push back on simplified projections. Mitigation: caveats pane that explicitly names assumptions, the scenario, the horizon, and the model version. Same discipline as core Dryline.

### Demo moment

Open the Wimberley page. Toggle from "current trend" to "20-year projection · drought-of-record." The chart bows downward steeply; an annotation reads "Trinity falls below historical median by 2031, below 1957 drought-of-record by 2038." Now click "add a user" and drop a 2 MGD pin three counties over. The line bows further. The room goes quiet.

### Score

| | | |
|---|---|---|
| Demo Impact | 5 | "Watch your aquifer go to zero" is the most arresting visual on this list. |
| Build Effort | 2 | Doing this right needs hydrogeology rigor; doing it wrong erodes Dryline's credibility. |
| Data Feasibility | 3 | Models exist and are open, but skilled application is non-trivial. |
| Strategic Moat | 5 | Forecasting that isn't trivially wrong is genuinely hard. |
| Architectural Fit | 3 | Heavier than current MCP tools — pre-computation pipeline + scenario store. |
| Path to Use | 4 | GCDs, regional planners, journalists, real-estate developers, GW district board members. |

---

## P5 (tie) — Graph Entry Points · *Tier B · 46*

**Pitch.** Add three new URL spaces alongside the address page: **Watershed view** (any HUC-12), **Aquifer view** (Edwards, Ogallala, Trinity…), **Industrial Actor view** (Samsung, Tesla, BlueOval). Same data, three new lenses. SEO surface area, journalist tools, civic-transparency anchors.

### What it adds to Dryline

The proposal already names the underlying object as a *water dependency graph*. Today the only entry point is a single graph node (an address). Three new entry points give the same graph three new ways in. The Industrial Actor view in particular is the sort of page that gets cited in news articles and tweeted — distribution gold.

### Build pieces

- **New routes.** `/watershed/[huc12]`, `/aquifer/[name]`, `/actor/[slug]`.
- **MCP tool: `summarize_watershed(huc12)`** — fans out existing tools across all addresses in the watershed; aggregates.
- **MCP tool: `summarize_actor(slug)`** — given Samsung, returns all known facilities, all permits, all watersheds, all monitoring wells affected.
- **Skill update.** Section on how the agent investigates a *non-address* entry point.
- **Slug curation.** A lightweight YAML registry of named entities (aquifers, big actors) so the slugs are stable and SEO-friendly.

### Data dependencies

Same as today's Dryline + USGS WBD watershed boundaries (free) + a curated actor registry (handmade for the top 50 TX water users; expand later).

### Risks

- **Naming collisions.** Multiple actors with similar names. Mitigation: explicit disambiguation pages (`/actor/samsung-taylor` not `/actor/samsung`).
- **Privacy.** Same constraint as the proposal — no individual well-owner names, only aggregate or named-facility / named-org entities.

### Demo moment

Type `dryline.app/aquifer/edwards` into a journalist's browser. The page renders: monitoring wells, J-17 reading, every active permit, every big user, the recharge zone, recent court cases. It's the page TX water journalism has been missing. Same shape for `/actor/samsung` — every Samsung facility, every permit, every watershed.

### Score

| | | |
|---|---|---|
| Demo Impact | 3 | Strong for the right audience (journalists), less arresting in a generalist 3-min slot. |
| Build Effort | 4 | Mostly UI + URL routing; data already collected. |
| Data Feasibility | 5 | Reuses existing tools. |
| Strategic Moat | 3 | Discoverable but not unique; the *quality* of the curated actor registry is the moat. |
| Architectural Fit | 5 | Extends naturally. |
| Path to Use | 4 | SEO, journalist tools, civic transparency, organic growth via citations. |

---

## P8 — Rebate Finder · *Tier B · 44*

**Pitch.** A structured database of every TX water utility's conservation rebate program, with eligibility-by-address. Either a standalone product *or* (better) a sub-component of P1 Resilience Plan.

### What it adds to Dryline

It makes the Resilience Plan's recommendations actionable with real dollars. Without rebates, "install a 1500 gal cistern" is a $3,000 ask. With them, it's a $1,000 ask. That's the difference between a recommendation read and a recommendation acted on.

### Build pieces

- **Scrape and normalize.** Crawl every TX utility's conservation page. Schema: utility, program, eligibility, rebate amount, application URL, last updated.
- **MCP tool: `get_rebates(address)`** — resolve address → utility → eligible programs.
- **Maintenance pipeline.** Programs change yearly; needs a refresh cadence.

### Reference programs (verified during research)

- **SAWS (San Antonio).** Cisterns: $1.00/gallon, max $2,000 (≥500 gal storage; cistern workshop required). WaterSaver coupons: $100 each, up to 4/year, 8 lifetime, drought-tolerant plants only, ≥200 sqft turf removal.
- **Austin Water.** Rainwater harvesting: $0.50/gal non-pressurized, $1.00/gal pressurized, max $5,000. Irrigation upgrades: up to $1,000. Pressure-regulating valves: up to $150. Watering timers: 50% off up to $40, two timers max.
- **El Paso Water.** Commercial WaterWise rebates up to $30,000. City code caps turf at 50% of landscape area. Residential rebates exist but are smaller.
- **LCRA WaterSmart.** Rebates exist for irrigation, scheduled to be reviewed annually.

No aggregator currently exists across these. Manual but bounded ETL.

### Risks

- **Maintenance debt.** Programs change. Mitigation: each entry has a `last_verified_at` field; show in UI; auto-flag stale records.
- **Out-of-scope sprawl.** Federal IRA rebates, RWAs, county programs. Mitigation: ship TX municipal water utilities first; defer the long tail.

### Demo moment

User on the Resilience Plan tab clicks "show eligible rebates." Three tiles: SAWS Cistern Rebate (estimated reimbursement $1,500), SAWS WaterSaver Coupon (up to $400 in plants), SAWS Drought-Resistant Landscape (up to $400 / 1,000 sqft). Each tile has the application URL and a one-line eligibility check.

### Score

| | | |
|---|---|---|
| Demo Impact | 3 | Useful but supportive, not headlining. |
| Build Effort | 5 | Bounded ETL; no novel tech. |
| Data Feasibility | 3 | Manual scraping; no APIs. |
| Strategic Moat | 3 | Replicable; defended by comprehensiveness. |
| Architectural Fit | 5 | Clean MCP tool. |
| Path to Use | 4 | Affiliate / contractor referrals; great SEO play (`"san antonio rainwater rebate"` searches are real). |

**Verdict.** Build P8 *as a sub-tool of P1*. Don't ship it standalone unless the Resilience Plan is delayed.

---

## P9 — Adjacent Layers Platform · *Tier C · 38*

**Pitch.** Reuse the `mcp/skill/web` architecture for adjacent environmental domains: air quality (TCEQ + EPA AQS), wildfire (Texas A&M Forest Service WUI), heat-island (Landsat thermal + canopy from imagery), Superfund / soil contamination, ERCOT grid stress, hurricane/flood forward-looking. Each is a sibling MCP server. Dryline stays water; the broader **"Vicinity"-style platform** is what grows around it.

### What it adds

A long-term strategic position. *Not a 2026 build.* This is the year-2-and-beyond shape, listed here so it's not surprising when it shows up.

### Why it's tier C *for now*

Because the per-layer effort is enormous and Dryline's wedge is water-supply depth, not environmental breadth. ClimateCheck, First Street, Telescope already occupy the broad-but-shallow space. Dryline wins by being deep on TX water; expanding domains without depth dilutes the position.

### Score

| | | |
|---|---|---|
| Demo Impact | 3 | Bigger pitch but weaker per-feature in a 3-min slot. |
| Build Effort | 1 | Very large — each new layer is its own MCP server. |
| Data Feasibility | 3 | Highly variable by domain. |
| Strategic Moat | 4 | Owning "TX environmental intelligence" end-to-end is real if executed. |
| Architectural Fit | 5 | Architecture was explicitly designed for this. |
| Path to Use | 4 | Broader audience but harder go-to-market. |

---

## Demo accents (not ranked — small features, not products)

These are sub-day enhancements that punch above their weight in a 3-minute demo. Pick whichever lands the cleanest beat in the demo flow:

- **Time machine slider.** Drag to rewind/fast-forward the map. Watch Comanche Springs go dry in 1955; watch the Edwards recharge zone urbanize; watch Samsung's footprint appear in 2024. Reuses existing time-series data. Half a day.
- **Sankey of your water.** Tap → utility → reservoir → river → headwaters. The supply chain made literal. ~D3 + existing `resolve_location` outputs. A day.
- **Voice mode.** "Hey Dryline, what's the water at 1234 Elm?" Browser SpeechRecognition + existing agent. Radio segments and accessibility. Half a day.
- **AR property mode (iOS).** Phone camera + on-device CV; agent overlays "cistern here," "rain garden here," "kill turf grass here" markers as you walk. Pairs with P1 Resilience Plan. Real iOS work — multi-day, but the demo video alone is worth it.
- **Compare mode.** Side-by-side any two addresses. Two days.

---

## Recommended sequence

The ranking gives a list, but builds happen in *bundles* — proposals that share architecture or data ETL.

### Sprint 1 — *"Personal mode gets a hero artifact"* (3–4 weeks)

Build **P1 Resilience Plan** with **P8 Rebate Finder** as its sub-component. This is the single biggest unlock: it turns Dryline from diagnostic into prescriptive, gives Personal mode an artifact equal in weight to Transparency mode's public comment, and creates a clear monetization surface (rebates, contractor referrals).

Concrete deliverables: NAIP imagery pipeline; vision segmentation MCP tool; rebate database for top 5 TX utilities (SAWS, Austin Water, El Paso, Houston, Dallas); resilience plan UI tab; SKILL.md "drafting a resilience plan" section.

### Sprint 2 — *"Distribution and synthesis"* (concurrent, 2–3 weeks)

Build **P2 Water Resilience Score** + **P3 Per-Address Newsletter**. Both are pure synthesis on existing tools — minimal new data work. Score gives a meme-able unit + embeddable widget for distribution; newsletter creates the recurring channel and email list. Together, this is the growth-loop sprint.

### Sprint 3 — *"Civic infrastructure"* (4–6 weeks)

Build **Permit Watcher** + **Graph Entry Points**. The TCEQ scraping ETL underpins both: Permit Watcher *uses* it, Graph Entry Points *displays* it on actor pages. SEO compounds across both.

### Sprint 4 — *"Forecasting and B2B"* (6–10 weeks, when there's a teammate)

Build **Aquifer Forecaster** + **Portfolio Mode**. The Forecaster needs hydrogeology rigor and is the highest-quality demo addition; Portfolio Mode is the first concrete B2B revenue line. Both want a second person.

### Year 2 — **Adjacent Layers**

Only after the water wedge is firmly held. Expand to air, wildfire, heat. The platform play.

---

## Open questions for Will

1. **Vision provider.** Claude vs. Gemini for the segmentation model — preference, or test both?
2. **Score branding.** Is it the "Dryline Score" or does it want a separate brand (the way Flood Factor is its own thing alongside First Street)? Naming materially affects distribution strategy.
3. **B2B vs. consumer first.** Sprint sequencing assumes consumer-first via Resilience Plan + Resilience Score + Newsletter. If the immediate post-hackathon priority is investor traction with a B2B story, Portfolio Mode jumps the queue.
4. **Permit Watcher monetization.** Free tier (single watershed) → paid tier (unlimited + faster scrape SLA), or fully free as civic infrastructure with grant funding?

---

## Research notes / sources

Imagery and vision:
- Google Street View Static API — pricing $0.0056–$0.007/panorama: https://developers.google.com/maps/documentation/streetview/usage-and-billing
- Mapillary API (free, CC BY-SA, Meta-owned post-2020): https://www.mapillary.com/developer/api-documentation
- USDA NAIP imagery (free, 0.6m/0.3m resolution, public domain): https://naip-usdaonline.hub.arcgis.com/
- USGSNAIPImagery REST service: https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer
- Vision segmentation reference (Roboflow solar roof measurement): https://blog.roboflow.com/solar-roof-measurement/

Texas utility rebate programs:
- SAWS Rainwater Harvesting: https://www.saws.org/conservation/residential-outdoor-programs-rebates/rainwater-harvesting/
- Austin Water rebates: https://www.austintexas.gov/department/rebates-tools-programs
- El Paso Water rebates: https://www.epwater.org/business/conservation/rebate-programs
- LCRA WaterSmart: https://www.lcra.org/water/watersmart/rebates/

Comparable products:
- First Street API overview: https://assets.firststreet.org/uploads/2020/06/First-Street-Foundation-API-V1.0.0-Overview-and-Data-Dictionary.pdf
- ClimateCheck methodology: https://climatecheck.com/our-methodologies
- Telescope (Mar 2025 funding, AI portfolio risk): https://netzeroinsights.com/resources/five-climate-risk-assessment-startups-redefining-how-risk-is-measured/
- Bloomberg on climate-risk-score limits (Dec 2025): https://www.bloomberg.com/news/articles/2025-12-09/real-estate-climate-risk-score-debate-reveals-limits-of-flood-fire-modeling

TCEQ permits:
- TCEQ pending air permits: https://www.tceq.texas.gov/permitting/air/newsourcereview/airpermits-pendingpermit-apps
- TCEQ Commissioners' Integrated Database: https://www.tceq.texas.gov/agency/decisions/participation/permitting-participation/HowToUseCID
- Pending permits documents: https://www.tceq.texas.gov/agency/decisions/participation/permitting-participation/pending-permits-documents-and-information

Forecasting:
- TWDB GAM program overview: https://www.twdb.texas.gov/groundwater/models/gam/index.asp
- Edwards/Trinity GAM: https://www.twdb.texas.gov/groundwater/models/gam/eddt_p/eddt_r.asp
- INTERA on GAMs (major contractor): https://www.intera.com/project/groundwater-availability-models-of-major-and-minor-aquifers-in-texas/

---

*Last updated: May 9, 2026 (Saturday — build day).*
