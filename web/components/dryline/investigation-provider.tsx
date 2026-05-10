"use client";

/**
 * InvestigationProvider — holds up to TWO active investigations.
 *
 * Single-mode (default): only the `primary` slot is in use; existing
 * components see exactly the same API as before.
 *
 * Compare-mode: both `primary` and `secondary` are in use. The two-panel
 * layout in page.tsx wraps each side in a SlotCtx that tells
 * useInvestigation() which slot to read.
 *
 *   <InvestigationProvider>
 *     <SlotCtx.Provider value="primary">
 *       <InvestigationPanel />        // useInvestigation() reads primary
 *     </SlotCtx.Provider>
 *     <SlotCtx.Provider value="secondary">
 *       <InvestigationPanel />        // useInvestigation() reads secondary
 *     </SlotCtx.Provider>
 *   </InvestigationProvider>
 *
 * Each slot runs an independent fetch + SSE stream; the two streams
 * are multiplexed client-side, no server-side coordination.
 */

import * as React from "react";
import type {
  ArtifactPayload,
  DemoLocationWithCoords,
  InvestigationStatus,
  Mode,
  ScorePayload,
  SynthesisPayload,
  TraceEvent,
} from "@/lib/types";

export type Slot = "primary" | "secondary";

interface InvestigationState {
  status: InvestigationStatus;
  location: DemoLocationWithCoords | null;
  mode: Mode | null;
  traces: TraceEvent[];
  synthesis: SynthesisPayload | null;
  artifact: ArtifactPayload | null;
  score: ScorePayload | null;
  error: string | null;
}

export interface SlotApi extends InvestigationState {
  start(location: DemoLocationWithCoords, modeOverride?: Mode): void;
  reset(): void;
}

interface MultiApi {
  primary: SlotApi;
  secondary: SlotApi;
  compareMode: boolean;
  setCompareMode(value: boolean): void;
  resetAll(): void;
  /** Open `loc` in the next empty slot when compareMode is on, else primary. */
  startNextAvailable(location: DemoLocationWithCoords, modeOverride?: Mode): void;
}

const initialState: InvestigationState = {
  status: "idle",
  location: null,
  mode: null,
  traces: [],
  synthesis: null,
  artifact: null,
  score: null,
  error: null,
};

const MultiCtx = React.createContext<MultiApi | null>(null);
const SlotCtx = React.createContext<Slot>("primary");

export { SlotCtx };

export function useMultiInvestigation(): MultiApi {
  const api = React.useContext(MultiCtx);
  if (!api) throw new Error("useMultiInvestigation must be used inside InvestigationProvider");
  return api;
}

/**
 * Reads from the slot specified by the nearest SlotCtx (defaulting to
 * "primary"). All existing consumers keep working unchanged in
 * single-mode and Just Work in the secondary panel when wrapped in a
 * SlotCtx.Provider.
 */
export function useInvestigation(): SlotApi {
  const slot = React.useContext(SlotCtx);
  return useMultiInvestigation()[slot];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function handleEvent(
  raw: string,
  setState: React.Dispatch<React.SetStateAction<InvestigationState>>,
) {
  const lines = raw.split("\n");
  let eventName = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }
  switch (eventName) {
    case "tool_start": {
      const p = payload as { toolName?: string; args?: unknown };
      if (!p.toolName) return;
      setState((s) => ({
        ...s,
        traces: [...s.traces, { type: "tool_start", toolName: p.toolName!, args: p.args }],
      }));
      return;
    }
    case "tool_result": {
      const p = payload as {
        toolName?: string;
        summary?: string;
        data?: unknown;
        sources?: unknown;
        caveats?: unknown;
      };
      if (!p.toolName) return;
      setState((s) => ({
        ...s,
        traces: [
          ...s.traces,
          {
            type: "tool_result",
            toolName: p.toolName!,
            summary: p.summary ?? "",
            data: p.data,
            sources: Array.isArray(p.sources) ? (p.sources as never) : [],
            caveats: Array.isArray(p.caveats) ? (p.caveats as never) : [],
          },
        ],
      }));
      return;
    }
    case "score": {
      const p = payload as Partial<ScorePayload>;
      if (typeof p.score !== "number" || !p.subscores || !p.rationale || !p.methodology) return;
      setState((s) => ({
        ...s,
        score: {
          score: p.score!,
          subscores: p.subscores!,
          rationale: p.rationale!,
          methodology: p.methodology!,
        },
      }));
      return;
    }
    case "synthesis": {
      const p = payload as { markdown?: string; sources?: unknown };
      setState((s) => ({
        ...s,
        synthesis: {
          markdown: p.markdown ?? "",
          sources: Array.isArray(p.sources) ? (p.sources as never) : [],
        },
      }));
      return;
    }
    case "artifact": {
      const p = payload as { kind?: string; title?: string; markdown?: string };
      if (!p.kind || !p.title || !p.markdown) return;
      setState((s) => ({
        ...s,
        artifact: { kind: p.kind!, title: p.title!, markdown: p.markdown! },
      }));
      return;
    }
    case "error": {
      const p = payload as { message?: string };
      setState((s) => ({ ...s, status: "error", error: p.message ?? "Unknown error" }));
      return;
    }
    case "done": {
      setState((s) => (s.status === "error" ? s : { ...s, status: "done" }));
      return;
    }
    default:
      return;
  }
}

function useSlotState(): {
  state: InvestigationState;
  start: SlotApi["start"];
  reset: () => void;
} {
  const [state, setState] = React.useState<InvestigationState>(initialState);
  const abortRef = React.useRef<AbortController | null>(null);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
  }, []);

  const start = React.useCallback<SlotApi["start"]>(
    async (location, modeOverride) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const effectiveMode: Mode = modeOverride ?? location.mode;
      setState({
        status: "streaming",
        location,
        mode: effectiveMode,
        traces: [],
        synthesis: null,
        artifact: null,
        score: null,
        error: null,
      });

      let res: Response;
      try {
        const cleanAddress = `${location.city}, ${location.county}, TX`;
        res = await fetch("/api/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: cleanAddress,
            mode: effectiveMode,
            headlineStory: location.headlineStory,
            humanScaleHook: location.humanScaleHook,
          }),
          signal: ac.signal,
        });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState((s) => ({ ...s, status: "error", error: errorMessage(err) }));
        return;
      }

      if (!res.ok || !res.body) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setState((s) => ({ ...s, status: "error", error: msg }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) !== -1) {
            const raw = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            handleEvent(raw, setState);
          }
        }
        if (buf.trim()) handleEvent(buf, setState);
      } catch (err) {
        if (ac.signal.aborted) return;
        setState((s) => ({ ...s, status: "error", error: errorMessage(err) }));
      }
    },
    [],
  );

  return { state, start, reset };
}

export function InvestigationProvider({ children }: { children: React.ReactNode }) {
  const primarySlot = useSlotState();
  const secondarySlot = useSlotState();
  const [compareMode, setCompareMode] = React.useState(false);

  const primary: SlotApi = React.useMemo(
    () => ({ ...primarySlot.state, start: primarySlot.start, reset: primarySlot.reset }),
    [primarySlot.state, primarySlot.start, primarySlot.reset],
  );
  const secondary: SlotApi = React.useMemo(
    () => ({ ...secondarySlot.state, start: secondarySlot.start, reset: secondarySlot.reset }),
    [secondarySlot.state, secondarySlot.start, secondarySlot.reset],
  );

  const resetAll = React.useCallback(() => {
    primarySlot.reset();
    secondarySlot.reset();
  }, [primarySlot, secondarySlot]);

  const startNextAvailable = React.useCallback<MultiApi["startNextAvailable"]>(
    (location, modeOverride) => {
      if (compareMode) {
        if (!primarySlot.state.location) {
          primarySlot.start(location, modeOverride);
        } else if (!secondarySlot.state.location) {
          secondarySlot.start(location, modeOverride);
        } else {
          // Both slots taken; replace primary (newest takes precedence).
          primarySlot.start(location, modeOverride);
        }
      } else {
        primarySlot.start(location, modeOverride);
      }
    },
    [compareMode, primarySlot, secondarySlot],
  );

  const value = React.useMemo<MultiApi>(
    () => ({
      primary,
      secondary,
      compareMode,
      setCompareMode,
      resetAll,
      startNextAvailable,
    }),
    [primary, secondary, compareMode, resetAll, startNextAvailable],
  );

  return <MultiCtx.Provider value={value}>{children}</MultiCtx.Provider>;
}
