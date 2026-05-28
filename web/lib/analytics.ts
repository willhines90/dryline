/**
 * Thin GA4 wrapper. The gtag.js loader lives in app/layout.tsx; this
 * file gives the rest of the app a typed call site without scattering
 * `window.gtag` casts everywhere. Every call is a no-op on the server
 * and a no-op in dev (so we don't pollute the LinkedIn-launch numbers
 * with test traffic from localhost).
 */

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

const enabled = (): boolean => {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return false;
  return typeof window.gtag === "function";
};

/**
 * Track a custom GA4 event. Params should be flat key/value pairs;
 * GA4 stores them as event parameters automatically.
 */
export function track(eventName: string, params?: Record<string, string | number | boolean>) {
  if (!enabled()) return;
  try {
    window.gtag!("event", eventName, params ?? {});
  } catch {
    /* never let analytics break the app */
  }
}
