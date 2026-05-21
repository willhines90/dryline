import type { Metadata } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Per the Claude Design bundle: Newsreader (editorial serif) + Geist (sans)
// + Geist Mono (data / trace). Loaded once at the layout level and exposed
// via CSS variables so Tailwind utilities can reach them.
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

const SITE_URL = "https://dryline-web.vercel.app";
const TITLE = "Dryline — Investigate Texas water at any address";
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
    "OpenAI Responses API",
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
      <body className="font-sans">{children}</body>
    </html>
  );
}
