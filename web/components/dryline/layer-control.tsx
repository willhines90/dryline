"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LayerKey =
  | "samples"
  | "drought"
  | "reservoirs"
  | "rivers"
  | "aquifers"
  | "gauges"
  | "dryline"
  | "radar"
  | "alerts"
  | "basins"
  | "gcds";

export type LayerGroup = "hydrology" | "climate" | "reference";

export interface LayerSpec {
  key: LayerKey;
  label: string;
  swatch: string;
  /** Section header the toggle appears under. */
  group: LayerGroup;
  /** When true, the toggle is rendered but disabled (data not available). */
  disabled?: boolean;
  /** Initial on/off state on first mount (before any localStorage override).
   *  Defaults to `true` unless explicitly set to `false`. Independent from
   *  `disabled` — a disabled layer can still be marked default-off. */
  defaultOn?: boolean;
  hint?: string;
}

const GROUP_LABELS: Record<LayerGroup, string> = {
  hydrology: "Hydrology",
  climate: "Climate & weather",
  reference: "Reference",
};

const LS_KEY = "dryline.layer-toggles.v1";

export function useLayerToggles(specs: LayerSpec[]): {
  state: Record<LayerKey, boolean>;
  toggle(k: LayerKey): void;
} {
  const base = React.useMemo(
    () =>
      Object.fromEntries(
        specs.map((s) => {
          // Disabled layers are forced off; otherwise honor defaultOn
          // (treating undefined as `true` for backwards compat).
          if (s.disabled) return [s.key, false];
          return [s.key, s.defaultOn !== false];
        }),
      ) as Record<LayerKey, boolean>,
    [specs],
  );

  const [state, setState] = React.useState<Record<LayerKey, boolean>>(base);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<LayerKey, boolean>>;
      setState((prev) => ({ ...prev, ...parsed }));
    } catch {
      /* swallow */
    }
  }, []);

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
  /** Match the dark/live cartography variant. */
  dark?: boolean;
}

export function LayerControl({ specs, state, onToggle, className, dark }: LayerControlProps) {
  const [open, setOpen] = React.useState(true);
  // Preserve the order specs are declared in within each group.
  const byGroup = React.useMemo(() => {
    const groups: LayerGroup[] = ["hydrology", "climate", "reference"];
    return groups
      .map((g) => ({ key: g, label: GROUP_LABELS[g], specs: specs.filter((s) => s.group === g) }))
      .filter((g) => g.specs.length > 0);
  }, [specs]);

  return (
    <div
      className={cn(
        "border backdrop-blur-sm shadow-paper",
        dark
          ? "border-aquifer/50 bg-[rgba(8,14,22,0.85)]"
          : "border-rule bg-paper-deep/95",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2",
          "font-mono text-[10px] tracking-[0.18em] uppercase",
          dark ? "text-spring hover:text-paper" : "text-tideline hover:text-ink",
        )}
      >
        <span>Layers</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className={cn("border-t", dark ? "border-aquifer/40" : "border-rule")}>
          {byGroup.map((g, gi) => (
            <div
              key={g.key}
              className={cn(
                gi > 0 && "border-t",
                dark ? "border-aquifer/40" : "border-rule",
              )}
            >
              <div
                className={cn(
                  "px-3 pt-1.5 pb-0.5 font-mono text-[8.5px] tracking-[0.18em] uppercase",
                  dark ? "text-spring/60" : "text-tideline/80",
                )}
              >
                {g.label}
              </div>
              <ul>
                {g.specs.map((s) => (
            <li
              key={s.key}
              className={cn(
                "border-t",
                dark ? "border-aquifer/30" : "border-rule/70",
              )}
            >
              <button
                type="button"
                onClick={() => !s.disabled && onToggle(s.key)}
                disabled={s.disabled}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left",
                  "font-mono text-[10.5px] tracking-[0.12em] uppercase",
                  s.disabled
                    ? cn("opacity-40 cursor-not-allowed", dark ? "text-spring/60" : "text-tideline")
                    : state[s.key]
                    ? dark
                      ? "text-paper"
                      : "text-ink"
                    : dark
                    ? "text-spring hover:text-paper"
                    : "text-tideline hover:text-ink",
                )}
                title={s.hint ?? s.label}
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-3 h-3 inline-block border shrink-0",
                    dark ? "border-aquifer/50" : "border-ink/30",
                  )}
                  style={{ background: state[s.key] ? s.swatch : "transparent" }}
                />
                <span className="truncate">{s.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "ml-auto font-mono text-[8.5px] tracking-[0.18em]",
                    state[s.key]
                      ? dark
                        ? "text-paper"
                        : "text-ink"
                      : dark
                      ? "text-spring/60"
                      : "text-tideline",
                  )}
                >
                  {s.disabled ? "—" : state[s.key] ? "ON" : "OFF"}
                </span>
              </button>
            </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
