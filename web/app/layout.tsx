import type { Metadata, Viewport } from "next";
import { Newsreader, Geist, Geist_Mono, Lato, Lora } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-M4P8YR9XSZ";

// Newsreader (editorial serif) + Geist (sans) + Geist Mono (data / trace)
// drive the in-app UI. Lato + Lora carry the brand lockup in the chrome:
// Lato for the "Dryline" wordmark, Lora italic for the tagline. All are
// loaded once here and exposed via CSS variables so Tailwind can reach
// them. (Google's Lato has no true 500 weight — 400 is what the brand
// wordmark SVG renders anyway.)
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lora",
  display: "swap",
});

const SITE_URL = "https://dryline.org";
const TITLE = "Dryline - Investigate Texas water at any address";
// Tight ~200 char meta description. The longer founder's-note copy lives
// in the About modal; this is what shows up under search results and in
// link unfurls, where brevity wins.
const DESCRIPTION =
  "Type any Texas address. Dryline streams a cited investigation across drought, reservoirs, drinking water, aquifers, and industrial dischargers — every claim sourced, every caveat structured.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Dryline",
  },
  description: DESCRIPTION,
  applicationName: "Dryline",
  authors: [{ name: "Will Hines", url: "https://github.com/willhines90" }],
  alternates: {
    canonical: SITE_URL,
  },
  keywords: [
    "Texas water",
    "TWDB",
    "EPA SDWIS",
    "EPA ECHO",
    "USGS NWIS",
    "U.S. Drought Monitor",
    "Trinity Aquifer",
    "Edwards Aquifer",
    "Ogallala",
    "MCP server",
    "agent skill",
    "Gemini",
    "Texas water rights",
    "NPDES",
    "GCD",
    "civic technology",
    "open data",
    "AITX hackathon",
  ],
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Dryline",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@willhines90",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "civic technology",
};

// Schema.org structured data. Three node graph:
//   1. WebSite — base entity for the domain, ties searchAction to the
//      address bar input so Google can surface a sitelinks search box.
//   2. Organization — author/publisher, ties citations from elsewhere
//      back to a stable entity.
//   3. WebApplication — describes Dryline as a free address-anchored
//      tool, enabling rich results for "what does X do" queries.
// JSON-LD ships in a <script type="application/ld+json"> tag in
// RootLayout below.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Dryline",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
      inLanguage: "en-US",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Dryline",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: ["https://github.com/willhines90/dryline"],
      founder: { "@type": "Person", name: "Will Hines" },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Dryline",
      url: SITE_URL,
      applicationCategory: "UtilityApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript.",
      description:
        "Type any Texas address. Dryline streams a cited investigation across drought, reservoirs, drinking water, aquifer monitoring, and federally-reportable industrial dischargers.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#org` },
      isAccessibleForFree: true,
      audience: {
        "@type": "Audience",
        audienceType: "Texas residents, journalists, civic researchers",
      },
    },
  ],
};

// viewportFit=cover lets the page draw into the safe-area inset region
// on notched iPhones. We use env(safe-area-inset-bottom) on the map's
// floating chips so they clear the home indicator instead of hiding
// behind it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Brand slate for the mobile browser chrome (address bar / PWA bar).
  themeColor: "#1E293B",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} ${lato.variable} ${lora.variable}`}
    >
      <body className="font-sans">
        {/* schema.org structured data — surfaces Dryline in Google Knowledge
            Graph and unlocks sitelinks searchbox / rich-result features. */}
        <Script
          id="ld-json"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {children}
        {/* Google Analytics 4. `afterInteractive` is the canonical strategy
            for gtag — loads after hydration so it doesn't block first
            paint, but in time to capture page_view on landing. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
