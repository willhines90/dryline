/**
 * /methodology — the public, citable explainer for the Dryline Score.
 *
 * Reductive scores invite skepticism. The cure is aggressive transparency:
 * every subscore's formula, every threshold, every data source linked.
 * If you screenshot the score, this is the page you cite alongside it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { DrylineLogo } from "@/components/dryline/dryline-logo";

export const metadata: Metadata = {
  title: "Dryline Score · Methodology",
  description:
    "How the Dryline Score is computed. Five public-data subscores — drought, drinking water, aquifer, reservoirs, industrial dischargers — equally weighted. Every threshold disclosed; every source linked.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "How the Dryline Score is computed",
    description:
      "Five public-data subscores, equally weighted. Every threshold disclosed; every source linked.",
    type: "article",
    url: "https://dryline.org/methodology",
  },
  twitter: {
    card: "summary_large_image",
    title: "How the Dryline Score is computed",
    description:
      "Five public-data subscores, equally weighted. Every threshold disclosed; every source linked.",
  },
};

const ARTICLE_LD = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "How the Dryline Score is computed",
  description:
    "Methodology for the Dryline Score: five public-data subscores covering drought, drinking water, aquifer monitoring, reservoirs, and industrial dischargers, equally weighted and fully cited.",
  url: "https://dryline.org/methodology",
  inLanguage: "en-US",
  author: {
    "@type": "Person",
    name: "Will Hines",
    url: "https://github.com/willhines90",
  },
  publisher: {
    "@type": "Organization",
    name: "Dryline",
    url: "https://dryline.org",
    logo: {
      "@type": "ImageObject",
      url: "https://dryline.org/icon.svg",
    },
  },
  mainEntityOfPage: "https://dryline.org/methodology",
  about: [
    { "@type": "Thing", name: "Texas water supply" },
    { "@type": "Thing", name: "U.S. Drought Monitor" },
    { "@type": "Thing", name: "EPA Safe Drinking Water Act" },
    { "@type": "Thing", name: "Texas aquifers" },
    { "@type": "Thing", name: "Industrial water pollution" },
  ],
};

interface SubscoreSpec {
  key: string;
  label: string;
  question: string;
  source: { abbr: string; full: string; url: string; cadence: string };
  formula: { input: string; ranges: Array<{ range: string; value: string }> };
  doesNotSay: string;
}

const SUBSCORES: SubscoreSpec[] = [
  {
    key: "drought",
    label: "Drought",
    question: "What's the current US Drought Monitor category for this county?",
    source: {
      abbr: "USDM",
      full: "U.S. Drought Monitor",
      url: "https://droughtmonitor.unl.edu/",
      cadence: "Updated weekly (Thursday).",
    },
    formula: {
      input: "Current USDM category at the county centroid.",
      ranges: [
        { range: "None", value: "0" },
        { range: "D0 (Abnormally Dry)", value: "20" },
        { range: "D1 (Moderate)", value: "40" },
        { range: "D2 (Severe)", value: "60" },
        { range: "D3 (Extreme)", value: "80" },
        { range: "D4 (Exceptional)", value: "100" },
      ],
    },
    doesNotSay:
      "USDM is a county-coarse classification. Local conditions a few miles apart can vary materially; tree-and-fence drought is not the same as well-and-aquifer drought.",
  },
  {
    key: "aquifer",
    label: "Aquifer",
    question:
      "What's the decadal depth-to-water trend at the nearest TWDB monitoring well?",
    source: {
      abbr: "TWDB GWDB",
      full: "Texas Water Development Board · Groundwater Database",
      url: "https://www.waterdatafortexas.org/groundwater",
      cadence: "Refreshed nightly from a state-published dump.",
    },
    formula: {
      input:
        "Decadal trend in ft/yr (positive = falling water table) at the nearest TWDB-instrumented well within 25 mi.",
      ranges: [
        { range: "Rising or flat (≤ 0 ft/yr)", value: "0" },
        { range: "0.5 ft/yr falling", value: "30" },
        { range: "1.0 ft/yr falling", value: "50" },
        { range: "1.5 ft/yr falling", value: "70" },
        { range: "2.0+ ft/yr falling", value: "90" },
      ],
    },
    doesNotSay:
      "A single monitoring well speaks for its hydrogeologic neighborhood, not the entire aquifer. Multi-decadal trend is a lagging signal; current pumping may be very different from what the trend implies.",
  },
  {
    key: "drinkingWater",
    label: "Drinking water",
    question:
      "Are there current Safe Drinking Water Act violations at the primary public water system serving this address?",
    source: {
      abbr: "EPA SDWIS",
      full: "EPA Safe Drinking Water Information System (via ECHO)",
      url: "https://echo.epa.gov/",
      cadence: "Reflects EPA's quarterly Federal SDWIS extract; known 3–6 month lag.",
    },
    formula: {
      input:
        "Per the primary PWS: H = current health-based violations, P = current procedural categories (monitoring, public-notice, other), R = total rules with violations in the last 3 years.",
      ranges: [
        { range: "Score = (H × 30) + (P × 10) + (R × 5)", value: "capped 0–100" },
      ],
    },
    doesNotSay:
      "Procedural violations (paperwork) and health-based violations (chemistry) are very different things; the score weights health-based heaviest but still surfaces procedural lapses. SDWIS underreports — EPA acknowledges the lag in their own documentation.",
  },
  {
    key: "industrial",
    label: "Industrial",
    question:
      "How many federally-reportable individual NPDES dischargers are within 15 mi?",
    source: {
      abbr: "EPA ECHO",
      full: "EPA ECHO Clean Water Act facilities",
      url: "https://echo.epa.gov/",
      cadence: "Daily refresh from the federal NPDES system.",
    },
    formula: {
      input:
        "Count of individual NPDES permits within a 15-mile radius of the resolved address.",
      ranges: [
        { range: "0 facilities", value: "0" },
        { range: "1 facility", value: "20" },
        { range: "2–3 facilities", value: "40" },
        { range: "4–6 facilities", value: "60" },
        { range: "7+ facilities", value: "80" },
      ],
    },
    doesNotSay:
      "Permitted discharge ≠ illegal pollution. An individual NPDES permit means the facility is regulated and reporting, not that it's contaminating anything. The score reflects density of regulated industrial water use, not harm.",
  },
  {
    key: "reservoir",
    label: "Reservoir",
    question:
      "How does the nearest instrumented reservoir compare to its same-day-of-year historical average?",
    source: {
      abbr: "TWDB",
      full: "TWDB Water Data for Texas",
      url: "https://waterdatafortexas.org/reservoirs",
      cadence: "Daily, for 37 instrumented major reservoirs statewide.",
    },
    formula: {
      input:
        "Ratio = currentPct ÷ historicalAvgPct (for the nearest reservoir within 50 mi).",
      ranges: [
        { range: "≥ 1.05 (well above average)", value: "0" },
        { range: "= 1.0", value: "20" },
        { range: "≈ 0.85", value: "40" },
        { range: "≈ 0.70", value: "60" },
        { range: "≈ 0.55", value: "80" },
        { range: "< 0.40", value: "100" },
      ],
    },
    doesNotSay:
      "Surface reservoir status is one input to supply, not the whole picture. A property on groundwater is barely coupled to the nearest reservoir; a property in a coastal city tied to the Highland Lakes is very tightly coupled.",
  },
];

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-background text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_LD) }}
      />
      <header className="border-b border-rule bg-background">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-baseline justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <DrylineLogo size={20} />
            <span className="font-serif text-[20px] font-semibold tracking-[-0.012em] text-ink">
              Dryline
            </span>
          </Link>
          <Link
            href="/"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink border border-rule px-2.5 py-1.5 transition-colors"
          >
            ← Back to map
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        <section className="space-y-3">
          <div className="dryline-label">Methodology</div>
          <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.02em] text-ink">
            How the Dryline Score is computed.
          </h1>
          <p className="font-serif italic text-tideline text-[18px] leading-relaxed">
            One 0–100 number per Texas address. Five public-data subscores, equally
            weighted. Every threshold is disclosed below. Higher score = more water stress.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-[24px] tracking-[-0.012em] text-ink">
            Why a single number.
          </h2>
          <p className="font-serif text-[16px] leading-relaxed text-ink/85">
            Reductive on purpose. The Dryline Score is the lede — the part that travels
            in a screenshot, a tweet, a real-estate listing. The cited synthesis below
            the score is the substance. The score exists to get the reader to read the
            substance.
          </p>
          <p className="font-serif text-[16px] leading-relaxed text-ink/85">
            We are aware of the criticism leveled at single-number climate-risk scores —
            Bloomberg ran a piece in late 2025 on the limits of climate-risk modeling,
            and Zillow notably pulled climate scores from listings. We take that
            seriously. The Dryline Score is built to be cited *alongside* this page, not
            in place of it: every threshold is on this page, every input is in the
            cited synthesis, every source has a retrieval timestamp.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[24px] tracking-[-0.012em] text-ink">
            The five subscores.
          </h2>
          <p className="font-serif text-[16px] leading-relaxed text-ink/85">
            Each subscore is bounded 0–100. The Dryline Score is their integer mean.
            Subscores that cannot be computed (e.g. no monitoring well within range,
            no reservoir within 50 mi) default to <strong className="font-semibold">50</strong>{" "}
            (neutral) and the rationale records the gap.
          </p>
          <div className="space-y-6">
            {SUBSCORES.map((s) => (
              <article
                key={s.key}
                className="border border-rule bg-card px-5 py-5"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="font-serif text-[20px] tracking-[-0.008em] text-ink">
                    {s.label}
                  </h3>
                  <a
                    href={s.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] tracking-[0.16em] uppercase text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink"
                  >
                    {s.source.abbr} ↗
                  </a>
                </div>
                <p className="font-serif italic text-tideline text-[14px] mt-1">
                  {s.question}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="dryline-label mb-1.5">Source</div>
                    <div className="font-serif text-[14px] text-ink leading-snug">
                      {s.source.full}
                    </div>
                    <div className="font-mono text-[11px] text-tideline mt-1">
                      {s.source.cadence}
                    </div>
                  </div>
                  <div>
                    <div className="dryline-label mb-1.5">Input</div>
                    <div className="font-serif text-[14px] text-ink leading-snug">
                      {s.formula.input}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="dryline-label mb-1.5">Banding</div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {s.formula.ranges.map((r, i) => (
                        <tr key={i} className="border-t border-rule">
                          <td className="font-serif text-[13.5px] text-ink py-1.5 pr-4">
                            {r.range}
                          </td>
                          <td className="font-mono text-[12px] text-ink/85 py-1.5 text-right whitespace-nowrap">
                            → {r.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 border-t border-dashed border-rule pt-3">
                  <div className="dryline-label mb-1.5">What this does NOT say</div>
                  <p className="font-serif text-[13.5px] italic text-tideline leading-snug">
                    {s.doesNotSay}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-[24px] tracking-[-0.012em] text-ink">
            Composition.
          </h2>
          <p className="font-serif text-[16px] leading-relaxed text-ink/85">
            <code className="font-mono text-[14px] bg-paper-deep px-1.5 py-0.5">
              score = round(mean(drought, aquifer, drinkingWater, industrial, reservoir))
            </code>
          </p>
          <p className="font-serif text-[16px] leading-relaxed text-ink/85">
            Equal weights are a deliberate v0 choice. They are easy to audit and easy to
            argue with. A future revision may weight subscores by user-mode (Personal
            mode probably weighting drinking water + aquifer higher; Transparency mode
            weighting industrial + reservoir higher); when that ships, this page will
            version itself and the score component will display the methodology version
            it was computed under.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-[24px] tracking-[-0.012em] text-ink">
            Bands.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-rule bg-card px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-tide">
                0–29 · Low stress
              </div>
              <p className="font-serif text-[14px] text-ink/85 mt-2 leading-snug">
                Healthy aquifer trend, no current SDWA violations, reservoirs near or
                above average, no surrounding drought.
              </p>
            </div>
            <div className="border border-rule bg-card px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ochre-deep">
                30–59 · Moderate stress
              </div>
              <p className="font-serif text-[14px] text-ink/85 mt-2 leading-snug">
                One or two subscores in the warning range. Typical for most of Texas
                in a normal year.
              </p>
            </div>
            <div className="border border-rule bg-card px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-rust">
                60–100 · High stress
              </div>
              <p className="font-serif text-[14px] text-ink/85 mt-2 leading-snug">
                Multiple subscores in the high range. Drought + falling aquifer +
                concentrated industrial use is the canonical shape.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-[24px] tracking-[-0.012em] text-ink">
            What the score is not.
          </h2>
          <ul className="font-serif text-[16px] leading-relaxed text-ink/85 space-y-2 list-disc pl-5">
            <li>
              Not a property valuation. We do not recommend using it in lending or
              insurance underwriting; FCRA-adjacent obligations may apply and we have
              not done that work.
            </li>
            <li>
              Not a forecast. The score reflects the most recent published state of each
              data source. It does not project forward.
            </li>
            <li>
              Not a substitute for professional advice. For health questions, contact
              your utility or local TCEQ office. For legal questions, contact an
              attorney. For engineering questions (well drilling, rainwater capture),
              contact a Texas-licensed contractor.
            </li>
            <li>
              Not a measure of personal blame or property quality. It describes the
              hydrologic environment around the address, not the address itself.
            </li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-rule pt-8">
          <h2 className="font-serif text-[24px] tracking-[-0.012em] text-ink">
            See it run.
          </h2>
          <p className="font-serif text-[16px] leading-relaxed text-ink/85">
            Every score on Dryline is computed from the same five subscores documented
            above, on the same public data, with every claim cited and every retrieval
            timestamped. Run an investigation and check the rationale strip below the
            score — it shows the exact value each subscore contributed and why.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/"
              className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-paper bg-ink hover:bg-aquifer transition-colors px-3 py-2"
            >
              → Try an address
            </Link>
            <a
              href="https://github.com/willhines90/dryline/blob/main/web/lib/dryline-score.ts"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink px-3 py-2"
            >
              → Read the source
            </a>
            <a
              href="https://github.com/willhines90/dryline"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink px-3 py-2"
            >
              → GitHub
            </a>
          </div>
        </section>

        <footer className="border-t border-dashed border-rule pt-6 pb-2">
          <p className="font-serif italic text-[13px] text-tideline leading-snug">
            Methodology v1 · published May 2026. Versioned alongside the
            <code className="font-mono text-[12px] bg-paper-deep px-1 mx-1">
              web/lib/dryline-score.ts
            </code>
            calculator in the open-source repo. Comments and corrections welcome via
            GitHub issues.
          </p>
        </footer>
      </article>
    </main>
  );
}
