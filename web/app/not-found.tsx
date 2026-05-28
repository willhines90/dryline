import type { Metadata } from "next";
import Link from "next/link";
import { DrylineLogo } from "@/components/dryline/dryline-logo";

export const metadata: Metadata = {
  title: "Not found · Dryline",
  description:
    "The page you're looking for doesn't exist on Dryline. Head back to the map or the score methodology.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-svh flex flex-col bg-background text-ink">
      <header className="border-b border-rule bg-paper-deep">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-baseline justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="Dryline — home">
            <DrylineLogo size={26} variant="front" />
            <span className="font-sans text-[20px] font-semibold tracking-[-0.025em] text-ink leading-none">
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

      <section className="flex-1 max-w-3xl mx-auto px-6 py-16 space-y-6">
        <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-rust">
          404 · Not found
        </div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.02em]">
          That page doesn&rsquo;t exist on Dryline.
        </h1>
        <p className="font-serif text-[17px] leading-relaxed text-ink/85 max-w-prose">
          Either it was renamed, it never existed, or the link that brought you
          here is stale. Nothing&rsquo;s broken with the rest of the site &mdash;
          just this one path.
        </p>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <Link
            href="/"
            className="group block border border-ink bg-ink text-paper px-4 py-3 no-underline transition-colors hover:bg-aquifer hover:border-aquifer"
          >
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-75">
              Primary
            </div>
            <div className="font-serif text-[15px] mt-1">Open the map &rarr;</div>
          </Link>
          <Link
            href="/methodology"
            className="group block border border-rule bg-card px-4 py-3 no-underline transition-colors hover:border-ink"
          >
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-tideline">
              Long read
            </div>
            <div className="font-serif text-[15px] mt-1 text-ink">
              Score methodology &rarr;
            </div>
          </Link>
        </div>

        <div className="pt-6 text-[13px] text-tideline">
          Broken link to report?{" "}
          <a
            href="https://github.com/willhines90/dryline/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] tracking-[0.14em] uppercase text-aquifer underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            File it on GitHub &uarr;
          </a>
        </div>
      </section>
    </main>
  );
}
