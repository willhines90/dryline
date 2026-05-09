import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
