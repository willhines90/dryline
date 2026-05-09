# Data sources used by Dryline

Each MCP tool draws from one or more of these. The skill cites whichever the tool returns; this catalog is reference material for the agent and for human reviewers.

| Source | Publisher | Access | Updated | Caveats the agent should surface |
|---|---|---|---|---|
| **Water Data for Texas** | TWDB | REST API at `waterdatafortexas.org` | Daily | Reservoir-level data lags 1–3 days; 122 major reservoirs only |
| **U.S. Drought Monitor** | NDMC / UNL / NOAA / USDA | REST at `usdmdataservices.unl.edu` | Weekly (Thursdays) | County-level summary; subcounty variation not captured |
| **USGS NWIS Water Services** | USGS | REST at `waterservices.usgs.gov` | Real-time (15-min instantaneous) | Gauges go offline; check last-reading timestamp |
| **EPA SDWIS via ECHO** | EPA | REST at `echodata.epa.gov` | Quarterly + ad hoc | EPA acknowledges 3–6 month reporting lag; some violations are paperwork, not contamination |
| **EPA ECHO regulated facilities** | EPA | REST at `echodata.epa.gov` | Continuous | Federal-reportable only; state-only TCEQ permits not always present |
| **TWDB Groundwater Database** | TWDB | Nightly bulk download (pipe-delimited) | Nightly | Monitoring well coverage uneven; one well does not represent a whole aquifer |
| **TNRIS Floodplain Quilt** | TxGIO | Bulk download via TxGIO DataHub | Annual (2021 cursory) | "Cursory" floodplain — not a substitute for FEMA FIRM panel review |
| **TNRIS StratMap parcels** | TxGIO + county appraisal districts | Bulk download | Variable by county | Geometry from county appraisal districts; quality varies |
| **TWDB GCD list** | TWDB | List + per-district websites | Variable | 100+ GCDs with different rules; we curate snapshots for demo districts |
| **TCEQ Drinking Water Watch** | TCEQ | Web forms (no API) | Continuous | We use ECHO instead for SDWIS; TCEQ-only items flagged as future work |
| **TCEQ Central Registry** | TCEQ | Web forms (no API) | Continuous | Federal-reportable subset accessible via ECHO; state-only via PIA |

## Attribution rule

Every result that incorporates one of these sources MUST cite it with a `Source` object containing:

- `title`: human-readable name
- `url`: canonical URL the user can open
- `retrievedAt`: ISO-8601 timestamp
- `publisher`: agency or organization name

The web app surfaces these citations in a sidebar panel. The skill cites them inline in synthesis prose.

## What we deliberately do NOT use

- **TCEQ behind-form scraping.** No scraping behind authentication or forms not intended for programmatic access.
- **Private well owner lists.** Even where TWDB publishes well owner names, we do not surface individual names in UI.
- **Real estate / parcel ownership.** Out of scope; raises privacy and accuracy issues we won't resolve in a weekend.
