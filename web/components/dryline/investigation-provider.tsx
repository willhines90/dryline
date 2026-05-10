"use client";

/**
 * InvestigationProvider — single source of truth for the cinematic
 * investigation flow on the right panel and the map's focus state.
 *
 * One investigation runs at a time. Starting a new one cancels any
 * in-flight stream by aborting its fetch. State machine:
 *
 *   idle → streaming → done
 *                    ↘ error
 *
 *   reset() returns to idle from any state and clears traces.
 */

import * as React from "react";
import type {
  ArtifactPayload,
  DemoLocationWithCoords,
  InvestigationStatus,
  Mode,
  SynthesisPayload,
  TraceEvent,
} from "@/lib/types";

interface InvestigationState {
  status: InvestigationStatus;
  location: DemoLocationWithCoords | null;
  /** Mode used by the active or just-finished investigation. */
  mode: Mode | null;
  traces: TraceEvent[];
  synthesis: SynthesisPayload | null;
  artifact: ArtifactPayload | null;
  error: string | null;
}

interface InvestigationApi extends InvestigationState {
  /** mode override; defaults to location.mode when omitted. */
  start(location: DemoLocationWithCoords, mode?: Mode): void;
  reset(): void;
}

const initialState: InvestigationState = {
  status: "idle",
  location: null,
  mode: null,
  traces: [],
  synthesis: null,
  artifact: null,
  error: null,
};

const Ctx = React.createContext<InvestigationApi | null>(null);

export function useInvestigation(): InvestigationApi {
  const api = React.useContext(Ctx);
  if (!api) throw new Error("useInvestigation must be used inside InvestigationProvider");
  return api;
}

export function InvestigationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<InvestigationState>(initialState);
  const abortRef = React.useRef<AbortController | null>(null);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
  }, []);

  const start = React.useCallback(
    async (location: DemoLocationWithCoords, modeOverride?: Mode) => {
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
        error: null,
      });

      let res: Response;
      try {
        // Build a geocoder-friendly address. The label embellishes with
        // em-dashes and project names that Nominatim ignores; bare
        // "city, TX" is also ambiguous (e.g. "Taylor, TX" resolves to
        // Taylor *County* out west, not the city of Taylor in
        // Williamson). Including the county disambiguates without the
        // "County" suffix that Nominatim rejects.
        const cleanAddress = `${location.city}, ${location.county}, TX`;
        res = await fetch("/api/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: cleanAddress,
            mode: effectiveMode,
            headlineStory: location.headlineStory,
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
          // Parse SSE: events are separated by blank lines.
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

  const value = React.useMemo<InvestigationApi>(
    () => ({ ...state, start, reset }),
    [state, start, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
