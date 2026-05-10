"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LayerKey = "drought" | "reservoirs" | "rivers" | "aquifers" | "gauges";

export interface LayerSpec {
  key: LayerKey;
  label: string;
  swatch: string; // hex
  /** When true, the toggle is rendered but disabled (data not available). */
  disabled?: boolean;
  hint?: string;
}

const LS_KEY = "dryline.layer-toggles.v1";

export function useLayerToggles(specs: LayerSpec[]): {
  state: Record<LayerKey, boolean>;
  toggle(k: LayerKey): void;
} {
  const initial = React.useMemo(() => {
    const base = Object.fromEntries(
      specs.map((s) => [s.key, !s.disabled]),
    ) as Record<LayerKey, boolean>;
    if (typeof window === "undefined") return base;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<Record<LayerKey, boolean>>;
      return { ...base, ...parsed };
    } catch {
      return base;
    }
  }, [specs]);

  const [state, setState] = React.useState<Record<LayerKey, boolean>>(initial);

  const toggle = React.useCallback((k: LayerKey) => {
    setState((s) => {
      const next = { ...s, [k]: !s[k] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* swallow */
      }
      return next;
    });
  }, []);

  return { state, toggle };
}

interface LayerControlProps {
  specs: LayerSpec[];
  state: Record<LayerKey, boolean>;
  onToggle(k: LayerKey): void;
  className?: string;
}

export function LayerControl({ specs, state, onToggle, className }: LayerControlProps) {
  const [open, setOpen] = React.useState(true);
  return (
    <div
      className={cn(
        "border border-rule bg-paper-deep/95 backdrop-blur-sm shadow-paper",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 font-mono text-[10px] tracking-[0.18em] uppercase text-tideline hover:text-ink"
      >
        <span>Layers</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <ul className="border-t border-rule">
          {specs.map((s) => (
            <li key={s.key} className="border-b border-rule last:border-b-0">
              <button
                type="button"
                onClick={() => !s.disabled && onToggle(s.key)}
                disabled={s.disabled}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left",
                  "font-mono text-[10.5px] tracking-[0.12em] uppercase",
                  s.disabled
                    ? "opacity-40 cursor-not-allowed text-tideline"
                    : state[s.key]
                    ? "text-ink"
                    : "text-tideline hover:text-ink",
                )}
                title={s.hint ?? s.label}
              >
                <span
                  aria-hidden
                  className="w-3 h-3 inline-block border border-ink/30 shrink-0"
                  style={{ background: state[s.key] ? s.swatch : "transparent" }}
                />
                <span className="truncate">{s.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "ml-auto font-mono text-[8.5px] tracking-[0.18em]",
                    state[s.key] ? "text-ink" : "text-tideline",
                  )}
                >
                  {s.disabled ? "—" : state[s.key] ? "ON" : "OFF"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
