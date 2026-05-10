"use client";

import * as React from "react";

/**
 * Dryline mark — a dashed diagonal line with two endpoints: the wet side
 * (aquifer marker) and the dry side (ochre marker). Pulled directly from
 * the design bundle's TopBar logo SVG.
 */
export function DrylineLogo({ size = 18, className }: { size?: number; className?: string }) {
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
