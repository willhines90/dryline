# Worked examples

Three full investigation traces showing the skill in action. Use these as the reference shape — same structure, different content, for any new address.

---

## Example 1 — Personal mode, Wimberley, TX

**User asks:** "I'm thinking about buying a place near Wimberley. Will the water last here?"

**Reasoning trace (visible to user):**

1. `resolve_location("[address], Wimberley, TX")` → lat/lng, Hays County (FIPS 48209), Trinity Aquifer region, Hays Trinity GCD, Wimberley Water Supply Corporation PWS.
2. Parallel fan-out:
   - `get_drought_status(48209)` → D2 severe drought, 78% county area, as of 2026-05-02 (USDM weekly).
   - `get_drinking_water(pws=TX1050003)` → small system, ~3,500 people served, GW source, 2 monitoring & reporting violations in last 5 years (procedural, not health-based).
   - `get_aquifer_status(lat, lng)` → Trinity Aquifer; nearest monitoring well shows -1.8 ft/yr decadal trend.
   - `get_river_flow(lat, lng)` → Blanco River at Wimberley gauge; current discharge 12 cfs vs median 41 cfs for May.
3. No `get_big_users_nearby` flagged at the 15-mile radius; transparency-mode signal not strong.

**Synthesis:**

> The Wimberley area pulls drinking water from the Trinity Aquifer through the Wimberley Water Supply Corporation, which serves about 3,500 people. The water system has had two procedural violations (monitoring & reporting) in the last five years; no health-based violations are recorded ([EPA SDWIS](#)). Hays County is currently in [D2 severe drought](#) (USDM, 2026-05-02), with 78% of the county area at D2 or worse. The nearest groundwater monitoring well shows the Trinity Aquifer dropping about 1.8 feet per year over the last decade ([TWDB GWDB](#)) — this is information, not a prediction. The Blanco River at the Wimberley gauge is running at 12 cfs against a May median of 41 cfs ([USGS NWIS](#)).
>
> *Dryline summarizes public Texas water data. It does not constitute legal, health, financial, or engineering advice. Verify findings against the linked sources before acting.*

**Action drafted: Watering / drought reminder.**

> Hays County is at Stage 2 drought conditions. Wimberley Water Supply Corporation customers are limited to outdoor watering on assigned days only and must use hand-held hoses or drip systems for landscape irrigation. The next stage change will be determined at the WWSC board's next meeting. ([WWSC drought rules](#))
>
> *This is a draft. Review the facts, citations, and tone before submitting.*

---

## Example 2 — Transparency mode, Taylor, TX

**User asks:** "What's actually going on with water around the Samsung fab in Taylor?"

**Reasoning trace:**

1. `resolve_location("[Samsung fab address], Taylor, TX")` → Williamson County (FIPS 48491), Trinity Aquifer + Lake Granger surface-water draw zone, Post Oak Savannah GCD region.
2. Parallel:
   - `get_drought_status(48491)` → D1 moderate drought, 100% of county at D0 or worse.
   - `get_reservoirs(lat, lng, 30)` → Lake Granger 67% full vs historical avg 78% for this date.
   - `get_big_users_nearby(lat, lng, 15)` → Samsung Austin Semiconductor (SAS) Taylor facility, NPDES permit listed, plus comparable industrial dischargers.
   - `get_active_permits(lat, lng, 15, since=2025-11-01)` → two relevant permits; one with open public comment window closing 2026-05-22.
3. No drinking-water issue surfaced for the immediate residential area; transparency-mode emphasis.

**Synthesis:**

> Williamson County is currently at [D1 moderate drought](#) (USDM, 2026-05-02). [Lake Granger](#) — the surface-water source for the Samsung facility — is at 67% of conservation capacity, against a historical average of 78% for this week. The largest permitted industrial water-related operation within 15 miles of central Taylor is the Samsung Austin Semiconductor Taylor plant, which holds an active NPDES discharge permit ([EPA ECHO](#)). Two water-related permits have been filed in the area since November 2025; one has an open public comment window closing 2026-05-22 ([TCEQ docket](#)).
>
> A flagged tension: Lake Granger is below historical average AND the area has multiple active industrial water permits. This is a correlation in the public record, not a causal claim about any specific facility's effect.
>
> *Dryline summarizes public Texas water data. It does not constitute legal, health, financial, or engineering advice. Verify findings against the linked sources before acting.*

**Action drafted: Public comment for the open permit.**

> To: TCEQ Office of the Chief Clerk
> RE: Permit application [docket number]
>
> I am submitting a public comment in advance of the 2026-05-22 deadline. Williamson County is currently in D1 drought conditions, and Lake Granger — a regional surface-water source — is at 67% of conservation capacity vs a historical 78% average for this week ([TWDB Water Data for Texas](#); [USDM](#)). The applicant's requested permit volume is [X MGD]; the Trinity Aquifer beneath the area shows a decadal decline of approximately [Y] ft/yr ([TWDB GWDB](#)).
>
> I respectfully request that the agency [user-supplied concern goes here].
>
> *This is a draft. Review the facts, citations, and tone before submitting. Insert your name and contact information before filing.*

---

## Example 3 — Transparency mode, Fort Stockton, TX

**User asks:** "What's the deal with Comanche Springs?"

**Reasoning trace:**

1. `resolve_location("Fort Stockton, TX")` → Pecos County (FIPS 48371), Edwards-Trinity Plateau Aquifer, Middle Pecos GCD.
2. Parallel:
   - `get_aquifer_status(lat, lng)` → Edwards-Trinity (Plateau) Aquifer; nearest monitoring well shows long-term decline.
   - `get_river_flow(lat, lng)` → Pecos River gauges; flow trends.
   - `get_big_users_nearby(lat, lng, 30)` → irrigated-agriculture permittees + Republic Water permit application.
   - `get_active_permits(lat, lng, 30, since=2024-01-01)` → active fight over a permit to ship Pecos County groundwater to El Paso.
3. No drinking-water emphasis (small-system); historical and regulatory emphasis.

**Synthesis:**

> Comanche Springs at Fort Stockton flowed continuously for centuries until 1950s irrigation pumping from the Edwards-Trinity (Plateau) Aquifer dried them up. The 1954 *Pecos County WCID v. Williams* decision (the *Belding* case) cemented Texas's rule-of-capture doctrine for groundwater. Today, the Edwards-Trinity (Plateau) Aquifer beneath the area continues to show long-term decline at the nearest TWDB monitoring well ([TWDB GWDB](#)). A current permit before TCEQ would allow Republic Water to export Pecos County groundwater to El Paso; the docket has been actively contested by local stakeholders ([TCEQ docket](#)).
>
> Modern echo of *Belding*: the rule-of-capture framework remains in effect; Middle Pecos GCD has limited authority to constrain export permits.
>
> *Dryline summarizes public Texas water data. It does not constitute legal, health, financial, or engineering advice. Verify findings against the linked sources before acting.*

**Action drafted: GCD board letter.**

> To: Middle Pecos Groundwater Conservation District Board of Directors
>
> I am writing in advance of your next board meeting regarding the Republic Water permit application currently before TCEQ. Public TWDB monitoring data shows the Edwards-Trinity (Plateau) Aquifer continuing its long-term decline at the nearest monitoring station ([TWDB GWDB](#)). The proposed export volume of [X acft/yr] would [user-supplied concern].
>
> I respectfully request that the GCD [user-supplied request].
>
> *This is a draft. Review the facts, citations, and tone before submitting. Insert your name and contact information before filing.*

---

These three are intentionally different in mode, tone, and artifact type. Don't multiply examples — three is enough to teach the pattern.
