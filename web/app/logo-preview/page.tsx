/**
 * Temporary logo-picker page. Renders DrylineLogo variants at the sizes
 * they'll appear in the wild, so we can pick one before committing.
 *
 * Delete this file once a variant is chosen.
 */

import { DrylineLogo, type LogoVariant } from "@/components/dryline/dryline-logo";

const variants: { key: LogoVariant; label: string; subtitle: string }[] = [
  {
    key: "scallop",
    label: "Scallop — the meteorological dryline",
    subtitle:
      "The actual NWS dryline symbol. Scalloped semicircles open onto the dry side. As literal as the metaphor gets.",
  },
  {
    key: "aquifer",
    label: "Aquifer — cross-section",
    subtitle:
      "Surface line + dashed water table + a drop between them. Reads as 'what's under your address.'",
  },
  {
    key: "confluence",
    label: "Confluence — moist Gulf meets dry continental",
    subtitle:
      "Two waves (wet, dry) meeting at a vertical dryline. The collision the West Texas weather is named for.",
  },
  {
    key: "radial",
    label: "Radial — investigation from a point",
    subtitle:
      "Concentric rings, like a well drawdown or an isobar. Center dot is the address; the rings are everything the agent gathers around it.",
  },
];

export default function LogoPreviewPage() {
  return (
    <main className="min-h-screen bg-paper p-12">
      <h1 className="font-serif text-2xl text-ink mb-2">Dryline logo — round 2</h1>
      <p className="font-serif italic text-tideline mb-8">
        Four water / meteorological directions. Same SVG rendered at 22px
        (header), 40px (large), and inverted on ink. Tell me which you want
        and I&apos;ll wire it in + delete the rest.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {variants.map((v) => (
          <section
            key={v.key}
            className="border border-rule bg-card p-6 flex flex-col gap-5"
          >
            <header>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-tideline">
                Variant — {v.key}
              </div>
              <div className="font-serif text-[17px] text-ink mt-0.5">{v.label}</div>
              <div className="font-serif italic text-[13px] text-tideline mt-1">
                {v.subtitle}
              </div>
            </header>

            <div className="flex items-baseline gap-2">
              <DrylineLogo size={22} variant={v.key} />
              <span className="font-serif text-[20px] font-semibold tracking-[-0.012em] text-ink">
                Dryline
              </span>
              <span className="font-mono text-[9.5px] text-tideline ml-2">22px · header</span>
            </div>

            <div className="flex items-baseline gap-3">
              <DrylineLogo size={48} variant={v.key} />
              <span className="font-serif text-[40px] font-semibold tracking-[-0.012em] text-ink">
                Dryline
              </span>
              <span className="font-mono text-[9.5px] text-tideline ml-2">48px · large</span>
            </div>

            <div className="-mx-6 -mb-6 mt-2 px-6 py-5 bg-ink flex items-baseline gap-2">
              <DrylineLogo size={22} variant={v.key} />
              <span className="font-serif text-[20px] font-semibold tracking-[-0.012em] text-paper">
                Dryline
              </span>
              <span className="font-mono text-[9.5px] text-paper/70 ml-2">on ink</span>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 font-serif italic text-tideline">
        Pick by variant name: scallop / aquifer / confluence / radial.
      </div>
    </main>
  );
}
