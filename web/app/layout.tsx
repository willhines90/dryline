import type { Metadata, Viewport } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-M4P8YR9XSZ";

// Newsreader (editorial serif) + Geist (sans) + Geist Mono (data / trace).
// Loaded once at the layout level and exposed via CSS variables so
// Tailwind utilities can reach them. The brand wordmark uses Geist
// at 600 — clean modern sans, no display-serif theatrics.
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

const SITE_URL = "https://dryline.org";
const TITLE = "Dryline - Investigate Texas water at any address";
const DESCRIPTION =
  "Texas added 2.6 million people in five years — more than any other state. Our water didn't keep up. Type any Texas address and Dryline streams a cited investigation across drought, reservoirs, drinking water, aquifer monitoring, and federally-reportable industrial dischargers — every claim sourced, structured caveats, drafted civic action.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Dryline",
  },
  description: DESCRIPTION,
  applicationName: "Dryline",
  authors: [{ name: "Will Hines", url: "https://github.com/willhines90" }],
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
  },
  category: "civic technology",
};

// viewportFit=cover lets the page draw into the safe-area inset region
// on notched iPhones. We use env(safe-area-inset-bottom) on the map's
// floating chips so they clear the home indicator instead of hiding
// behind it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body className="font-sans">
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
