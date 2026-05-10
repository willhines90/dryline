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

export const metadata: Metadata = {
  title: "Dryline — Investigate Texas water at any address",
  description:
    "Environmental intelligence for a thirsty state. Drought, reservoirs, drinking water, aquifer health, and large permitted users — all from public Texas data, with citations.",
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
