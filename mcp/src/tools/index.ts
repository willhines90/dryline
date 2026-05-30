/**
 * Tool registry. The MCP server iterates this list to advertise and dispatch.
 *
 * Order matters for the agent skill — the first five form the
 * minimum-viable-winning-version (see PROPOSAL.md fallback section).
 * Build them end-to-end before reaching for tools 6–9.
 */

import type { DrylineTool } from "../types.js";

import { resolveLocation } from "./resolveLocation.js";
import { getDroughtStatus } from "./getDroughtStatus.js";
import { getReservoirs } from "./getReservoirs.js";
import { getDrinkingWater } from "./getDrinkingWater.js";
import { getBigUsersNearby } from "./getBigUsersNearby.js";
import { getAquiferStatus } from "./getAquiferStatus.js";
import { getActivePermits } from "./getActivePermits.js";
import { getRiverFlow } from "./getRiverFlow.js";
import { getWaterQuality } from "./getWaterQuality.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: DrylineTool<any, any>[] = [
  // 1–5: minimum viable winning version
  resolveLocation,
  getDroughtStatus,
  getReservoirs,
  getDrinkingWater,
  getBigUsersNearby,
  // 6–9: stretch
  getAquiferStatus,
  getActivePermits,
  getRiverFlow,
  getWaterQuality,
];
