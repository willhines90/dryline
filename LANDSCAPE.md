# Dryline — Competitive Landscape & Gap Analysis

**Purpose:** Document where Dryline sits in the existing tooling ecosystem, what each adjacent category does, and where the gaps are. Source of truth for pitch slides, partnership conversations, and the unspoken "but doesn't X already do this?" question every judge will have.

---

## The five categories of prior art

### 1. Texas water data portals

**Examples:** TWDB (Water Use Survey, Water Loss, Planning Data, GWDB, Water Service Boundary Viewer); TCEQ (Public Notices CID, permit databases); Texas Water Data Hub; The Nature Conservancy's Texas Water Explorer (with Meadows Center).

**What they do well:** Authoritative source data. Comprehensive. Free. Many shipped in the last few years.

**Where they stop:** Built for analysts, lawyers, and water professionals. Each portal is a silo. To answer "what's happening with water at this address" you'd have to query 4–6 separately and stitch the answer yourself. The only address-based tool is TWDB's Service Boundary Viewer — and it just tells you who your provider is.

### 2. Climate-risk address scoring

**Examples:** First Street Foundation / Risk Factor; ClimateCheck; Telescope; Jupiter Intelligence.

**What they do well:** Parcel-level risk story readable in 30 seconds. Strong consumer UX. Embedded in Zillow, Realtor, and lending workflows.

**Where they stop:** None of them score water *supply.* They cover flood, fire, heat, wind, and coastal risk. Insurance and mortgage drove that wedge — water-supply has more diffuse buyers, which is exactly why it's still open.

### 3. Federal environmental tools

**Examples:** EPA ECHO (Enforcement & Compliance History Online — 800k+ regulated facilities); EPA EJScreen (12 environmental + demographic indexes by Census block); USGS National Water Dashboard.

**What they do well:** National. Authoritative. Free. Well-API'd.

**Where they stop:** They answer "are there violations near me" or "is my block burdened." They don't answer "where's my water coming from, what's threatening it, and what can I do." None are Texas-specific. None are water-supply-centric.

### 4. Permit-watch and civic-comment tooling

**Examples:** TCEQ CID email alerts (zip / county / permit-number subscriptions); Regulations.gov; Public Comment Project.

**What they do well:** TCEQ's email alerts are real progress — a citizen can get notified when a comment window opens in their zip code.

**Where they stop:** The workflow ends at notification. You still get a PDF, you still write the comment from scratch, and nothing helps you understand whether the proposed permit *matters* in your watershed, your aquifer, or the current drought stage. Public Comment Project goes further on drafting — but for federal rules, not Texas environmental permits.

### 5. Conservation scorecards and advocacy

**Examples:** Texas Living Waters Project (TLWP) — 2020 Conservation Scorecard evaluating 356 utilities; Sierra Club Lone Star Chapter; Hill Country Alliance; Meadows Center for Water and the Environment.

**What they do well:** Professional-grade analysis, organized by issue. The 2020 Scorecard is genuinely good.

**Where they stop:** These are published artifacts (PDFs, scorecards, blog posts), not interactive tools. They tell you the state of things in aggregate; they don't help an individual at an address right now.

### Wildcard: AI agents and MCP servers

By early 2026 there are 10,000+ MCP servers in the wild. Almost none for environmental civic data. NL2SQL agents over enterprise data are common; nothing serious for Texas water. The agent-native, MCP-plus-skill, narrative-with-citations shape is essentially greenfield in this domain — and the hackathon brief explicitly rewards teams that ship both.

---

## The four-layer wedge

The reason nothing in market looks like Dryline isn't that the pieces don't exist — it's that **nobody has stacked all four layers**:

1. **Synthesis.** Combine TCEQ + TWDB + GCD + USGS + utility data into one coherent picture for one address. Today that takes hours across 5+ portals.
2. **Interpretation.** Translate "aquifer at 67% of historical, drought stage 3, pending 4M-gallon permit upstream" into language a homeowner or journalist can use. The data is there; the meaning isn't.
3. **Action.** Close the loop from "you should care" to "here's a draftable, citation-backed public comment on the actual permit." TCEQ alerts open the door; nothing walks you through it.
4. **Water as the lens.** Every address-level tool today either covers everything (EJScreen, ECHO) or covers the wrong risks (First Street). Water-supply-as-primary-lens with Texas-specific depth is a clearing.

---

## Three legs of the stool

A useful way to summarize the moat:

- **TWDB has the data.** They don't have a consumer surface — they're a board, not a product team.
- **First Street has the consumer surface.** They don't have water supply — insurance buyers don't ask for it yet.
- **Sierra Club / TLWP have the issue framing.** They don't have the engineering.

Dryline is the first product that puts those three in one place. The agent-native architecture is what makes it cheap enough for a small team to actually do it.

---

## Risks worth naming

- **TWDB or First Street could build this.** They haven't because mandate doesn't equal capability — but a well-funded incumbent could enter the wedge if it became attractive enough. Defensive answer: open-source the agent skill and the schema, so the wedge becomes a category convention rather than a single product.
- **Conservation orgs as competitor or partner?** TLWP / Hill Country Alliance have the issue framing. Partnership is more likely than competition; they don't have engineering, we don't have long-haul advocacy muscle.
- **California precedent.** The California State Water Board's 2025 Aquifer Risk Map is the closest US analog — but it tracks domestic-well water *quality,* not supply. The Texas equivalent for supply is still unbuilt.

---

## How to use this framing in the pitch

In one sentence: **"The address-based environmental tools you know stop where water supply begins."** That puts Dryline in the Risk Factor / EJScreen mental model but in a category they explicitly haven't entered.

If you have ten seconds of slide real estate, show four cards in a row:

| Tool | What it tells you | Where it stops |
|---|---|---|
| First Street / Risk Factor | Flood, fire, heat at any address | No water supply |
| EPA EJScreen | Pollution and EJ indicators by Census block | Not address-level, not water-supply-focused |
| TWDB dashboards | Texas water in aggregate | Not address-anchored, not narrative |
| TLWP Scorecard | Conservation performance by utility | Published PDF, not interactive |

Dryline sits in the empty box: address-anchored, water-supply lens, Texas-deep, agent-native.

---

## Sources

- [Texas Water Explorer (TNC + Meadows)](https://texaswaterexplorer.tnc.org/)
- [TWDB Data, Apps and Maps](https://www.twdb.texas.gov/mapping/)
- [TWDB dashboards explainer](https://texaswaternewsroom.org/articles/the_texas_water_development_board_dashboards_are_a_gateway_to_essential_statewide_water_data.html)
- [Texas Water Data Hub](https://txwaterdatahub.org/)
- [Texas Living Waters Project](https://texaslivingwaters.org/)
- [2020 Texas Water Conservation Scorecard](https://texaslivingwaters.org/wp-content/uploads/2020/06/2020-Texas-Water-Conservation-Scorecard_June-2020.pdf)
- [TCEQ Public Notices search](https://www.tceq.texas.gov/agency/decisions/cc/pub_notice.html)
- [TCEQ email-notice opportunity announcement](https://www.tceq.texas.gov/news/releases/tceq-launches-public-notice-by-email-opportunity)
- [TCEQ Submit Public Comments](https://www.tceq.texas.gov/agency/decisions/e-comments.html)
- [EPA ECHO](https://echo.epa.gov/)
- [EPA EJScreen updates](https://www.epa.gov/newsreleases/epa-launches-updates-environmental-justice-mapping-tool-ejscreen)
- [California 2025 Aquifer Risk Map methodology (closest US analog)](https://www.waterboards.ca.gov/gama/docs/armmethods25.pdf)
- [MCP ecosystem state, early 2026 (Wikipedia)](https://en.wikipedia.org/wiki/Model_Context_Protocol)

---

*Companion docs: `PITCH.md` (slide narrative), `DEMO.md` (live demo script), `EXTENSIONS.md` (post-hackathon roadmap), `PROPOSAL.md` (full project spec).*
