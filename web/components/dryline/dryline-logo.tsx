"use client";

import * as React from "react";

export type LogoVariant =
  | "current"
  | "scallop"
  | "aquifer"
  | "confluence"
  | "radial"
  | "front";

interface DrylineLogoProps {
  size?: number;
  className?: string;
  variant?: LogoVariant;
}

/**
 * Dryline mark — variants on the meteorological / hydrological metaphors
 * that define the product. Pick one via the `variant` prop. The fallback
 * is `current` so older call sites stay safe.
 *
 *   - `current`    — original dashed diagonal, two endpoints.
 *   - `scallop`    — the literal meteorological dryline glyph: a line
 *                    with scalloped "humps" on the dry side. This is
 *                    how the National Weather Service draws a dryline.
 *   - `aquifer`    — water-table cross-section: surface line, dotted
 *                    water table beneath, a drop between them.
 *   - `confluence` — two wavy lines (moist Gulf air, dry continental
 *                    air) meeting at a vertical boundary.
 *   - `radial`     — concentric rings, like a monitoring-well draw-
 *                    down cone or a pressure isobar — "investigation
 *                    radiating from an address."
 */
export function DrylineLogo({ size = 18, className, variant = "current" }: DrylineLogoProps) {
  switch (variant) {
    case "front":
      return <FrontMark size={size} className={className} />;
    case "scallop":
      return <ScallopMark size={size} className={className} />;
    case "aquifer":
      return <AquiferMark size={size} className={className} />;
    case "confluence":
      return <ConfluenceMark size={size} className={className} />;
    case "radial":
      return <RadialMark size={size} className={className} />;
    case "current":
    default:
      return <CurrentMark size={size} className={className} />;
  }
}

/**
 * The "front" variant: a capital D whose vertical spine + caps are
 * drawn cleanly, but whose curved bow is rendered as a meteorological
 * weather-front glyph — the classic blue cold-front symbol (a line
 * with triangles pointing in the direction of motion). The shape
 * reads as a D from a distance and as "weather forecast" up close.
 *
 * Designed at viewBox 0 0 32 32 so it scales cleanly at any size.
 * Stroke widths are tuned for legibility at 22–40 px.
 */
function FrontMark({ size, className }: { size: number; className?: string }) {
  // Bow arc parameters. The bow's apex is at (28, 16); it joins the
  // top cap at (10, 4) and the bottom cap at (10, 28). The triangles
  // are pointed OUTWARD from the bow (the cold-front motion direction
  // in standard NWS notation: triangles point toward the warmer side
  // the front is advancing into).
  const stroke = "#0d3b6f"; // aquifer
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      role="img"
    >
      {/* Spine of the D — vertical bar on the left */}
      <line x1="6" y1="4" x2="6" y2="28" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {/* Top + bottom caps connecting spine to bow */}
      <line x1="6" y1="4" x2="11" y2="4" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      <line x1="6" y1="28" x2="11" y2="28" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {/* The bow itself — a smooth curve from top cap to bottom cap */}
      <path
        d="M 11 4 C 22 4, 26.5 9.5, 26.5 16 C 26.5 22.5, 22 28, 11 28"
        fill="none"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cold-front triangles ON the bow, pointing outward (east). Five
          triangles spaced along the arc — they ride along the curve
          like teeth on a saw blade. */}
      <polygon points="14.5,3 17,0 15.7,4.5" fill={stroke} />
      <polygon points="21,5.5 25,3.5 22,7.8" fill={stroke} />
      <polygon points="25.5,10.5 30,10 26.7,13" fill={stroke} />
      <polygon points="25.5,21.5 30,22 26.7,19" fill={stroke} />
      <polygon points="21,26.5 25,28.5 22,24.2" fill={stroke} />
      <polygon points="14.5,29 17,32 15.7,27.5" fill={stroke} />
    </svg>
  );
}

function CurrentMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className={className}
      aria-hidden
      role="img"
    >
      <line
        x1="2"
        y1="14"
        x2="16"
        y2="4"
        stroke="hsl(var(--foreground))"
        strokeWidth="1.6"
        strokeDasharray="2 2"
      />
      <circle cx="2" cy="14" r="2" fill="#0d3b6f" />
      <circle cx="16" cy="4" r="2" fill="#b58a52" stroke="#7a5a2c" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Meteorological dryline glyph. NWS surface-analysis maps render a
 * dryline as an orange line with open scallops (semicircles) on the
 * dry side pointing toward the dry air mass. We tilt it slightly so
 * it reads as a mark rather than a chart annotation.
 */
function ScallopMark({ size, className }: { size: number; className?: string }) {
  // Five bumps along a diagonal line, scallops opening upward (dry side).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      role="img"
    >
      {/* base line */}
      <line
        x1="2"
        y1="17"
        x2="22"
        y2="7"
        stroke="#b58a52"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* scallops on dry side (upper) — each is a tiny half-circle bump above the line */}
      <g fill="none" stroke="#b58a52" strokeWidth="1.6" strokeLinecap="round">
        <path d="M 4.5 15.75 A 1.6 1.6 0 0 1 7.5 14.25" />
        <path d="M 9 13.5 A 1.6 1.6 0 0 1 12 12" />
        <path d="M 13.5 11.25 A 1.6 1.6 0 0 1 16.5 9.75" />
        <path d="M 18 9 A 1.6 1.6 0 0 1 21 7.5" />
      </g>
      {/* moist endpoint (wet side anchor) */}
      <circle cx="2" cy="17" r="2" fill="#0d3b6f" />
    </svg>
  );
}

/**
 * Aquifer cross-section. A solid horizontal "surface" line, a dashed
 * "water table" line beneath it, with a single drop falling/rising
 * between them. The whole mark reads as "what's under your address."
 */
function AquiferMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      className={className}
      aria-hidden
      role="img"
    >
      {/* surface */}
      <line
        x1="2"
        y1="7"
        x2="20"
        y2="7"
        stroke="hsl(var(--foreground))"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* water-table — dashed because it moves */}
      <line
        x1="2"
        y1="16"
        x2="20"
        y2="16"
        stroke="#0d3b6f"
        strokeWidth="1.4"
        strokeDasharray="2.4 1.8"
        strokeLinecap="round"
      />
      {/* drop — water descending from surface to water table */}
      <path
        d="M 11 8.5 C 9.5 11 9.5 13 11 14.5 C 12.5 13 12.5 11 11 8.5 Z"
        fill="#0d3b6f"
      />
      {/* small tick at the top — the address marker */}
      <line
        x1="11"
        y1="3"
        x2="11"
        y2="7"
        stroke="#b58a52"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="11" cy="3" r="1.4" fill="#b58a52" stroke="#7a5a2c" strokeWidth="0.5" />
    </svg>
  );
}

/**
 * Confluence — moist Gulf air (wave from below) meeting dry
 * continental air (wave from above) at a vertical dryline. The
 * dryline itself is a thin dashed center.
 */
function ConfluenceMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      className={className}
      aria-hidden
      role="img"
    >
      {/* upper wave — dry air (ochre) */}
      <path
        d="M 1 6 Q 4 3, 7 6 T 11 6"
        fill="none"
        stroke="#b58a52"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* lower wave — moist air (aquifer) */}
      <path
        d="M 11 16 Q 14 13, 17 16 T 21 16"
        fill="none"
        stroke="#0d3b6f"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* the dryline — vertical boundary where they meet */}
      <line
        x1="11"
        y1="2.5"
        x2="11"
        y2="19.5"
        stroke="hsl(var(--foreground))"
        strokeWidth="1.5"
        strokeDasharray="2.4 1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Radial — concentric rings, like a drawdown cone around a pumping
 * well or a pressure isobar. Reads as "investigation radiating out
 * from a single address." The center dot is the address.
 */
function RadialMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      className={className}
      aria-hidden
      role="img"
    >
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="#0d3b6f"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeDasharray="2.4 2"
      />
      <circle
        cx="11"
        cy="11"
        r="6"
        fill="none"
        stroke="#0d3b6f"
        strokeOpacity="0.6"
        strokeWidth="1.3"
      />
      <circle
        cx="11"
        cy="11"
        r="3"
        fill="none"
        stroke="#0d3b6f"
        strokeOpacity="0.95"
        strokeWidth="1.4"
      />
      <circle cx="11" cy="11" r="1.7" fill="#b58a52" stroke="#7a5a2c" strokeWidth="0.6" />
    </svg>
  );
}
