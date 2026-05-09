import type { Source, Caveat } from "../types.js";

/** ISO timestamp helper — current time, second precision. */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Build a Source with the current retrievedAt timestamp.
 */
export function source(args: {
  title: string;
  url: string;
  publisher?: string;
}): Source {
  return { ...args, retrievedAt: now() };
}

/** Standard freshness caveat: "data as of <isoDate>, source updates <cadence>". */
export function freshnessCaveat(args: {
  asOf: string;
  cadence: string;
  severity?: Caveat["severity"];
}): Caveat {
  return {
    severity: args.severity ?? "info",
    category: "freshness",
    message: `Data as of ${args.asOf}; this source updates ${args.cadence}.`,
  };
}

/** Standard "what this does NOT say" caveat. */
export function boundsCaveat(message: string, severity: Caveat["severity"] = "info"): Caveat {
  return { severity, category: "bounds", message };
}

/** Convert an unknown error to an error-severity Caveat for tool-boundary failures. */
export function errorCaveat(err: unknown, context: string): Caveat {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    severity: "error",
    category: "quality",
    message: `${context}: ${msg}`,
  };
}
