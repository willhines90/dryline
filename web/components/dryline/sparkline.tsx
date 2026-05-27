"use client";

import * as React from "react";

interface Point {
  v: number | null;
}

interface SparkLineProps {
  /** Series ordered oldest → newest. Null values are skipped. */
  data: Point[];
  width?: number;
  height?: number;
  /** Stroke color. Defaults to aquifer blue. */
  color?: string;
  /** Optional horizontal reference line (e.g. historical average). */
  reference?: number | null;
  /** Aria label for screen readers. */
  label?: string;
  className?: string;
}

/**
 * Tiny inline SVG sparkline. Designed for tooltips + detail cards.
 *
 * Renders a smooth polyline through the numeric points, drops a dot on
 * the most recent value, and optionally draws a dashed horizontal
 * reference line (e.g. the historical average for a reservoir or the
 * median flow for a gauge). All scaling is intrinsic to the data so the
 * same component works for percent-full (0–100) and cfs (5–50,000).
 */
export function SparkLine({
  data,
  width = 120,
  height = 28,
  color = "#0d3b6f",
  reference,
  label,
  className,
}: SparkLineProps) {
  const pts = data
    .map((p, i) => (typeof p.v === "number" ? { i, v: p.v } : null))
    .filter((p): p is { i: number; v: number } => p !== null);
  if (pts.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label={label ?? "No data"}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#9ec5cf"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const padX = 1;
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const vs = pts.map((p) => p.v);
  let vmin = Math.min(...vs);
  let vmax = Math.max(...vs);
  if (typeof reference === "number") {
    vmin = Math.min(vmin, reference);
    vmax = Math.max(vmax, reference);
  }
  if (vmin === vmax) {
    // Single-value or perfectly flat series — give the y-axis a token range
    // so the line draws horizontally through the middle rather than at the
    // edge of the SVG.
    vmin -= 0.5;
    vmax += 0.5;
  }
  const span = vmax - vmin;
  const xStep = pts.length > 1 ? innerW / (pts.length - 1) : 0;

  const xAt = (i: number) => padX + i * xStep;
  const yAt = (v: number) => padY + innerH * (1 - (v - vmin) / span);

  // Build the path. Use a smooth-ish piecewise line (no curves — keeps
  // small flicks readable; smoothing would mute the signal).
  const d = pts
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xAt(idx).toFixed(2)} ${yAt(p.v).toFixed(2)}`)
    .join(" ");

  const last = pts[pts.length - 1]!;
  const cx = xAt(last.i === undefined ? pts.length - 1 : pts.length - 1);
  const cy = yAt(last.v);

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={label ?? "Sparkline"}
    >
      {typeof reference === "number" ? (
        <line
          x1={padX}
          x2={width - padX}
          y1={yAt(reference)}
          y2={yAt(reference)}
          stroke="#b58a52"
          strokeOpacity="0.7"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      ) : null}
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r="2.2" fill={color} />
    </svg>
  );
}
