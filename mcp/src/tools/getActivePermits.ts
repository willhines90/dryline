/**
 * get_active_permits — recent water-related permit filings near a point.
 *
 * Source: EPA ECHO (for federally-reportable) + curated TCEQ snapshot for
 * state-only permits. The TCEQ Central Registry is form-driven; ECHO is the
 * preferred path. Document any TCEQ-only gaps in the README.
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - Filter to permits filed since the `since` date.
 * - For each, surface: permit type, applicant, requested volume, comment
 *   deadline (if open), and a link to the public docket.
 * - Caveat: comment deadlines from TCEQ are not always machine-readable;
 *   the agent should hedge if the deadline isn't structured.
 */

import { z } from "zod";
import type { DrylineTool } from "../types.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(50).default(15),
  since: z.string().describe("ISO date; only return permits filed on or after this date.").optional(),
});

type Input = z.infer<typeof inputSchema>;

interface ActivePermitsOutput {
  permits: Array<{
    permitId: string;
    type: string;
    applicant: string;
    filedDate: string;
    requestedVolumeMgd?: number;
    commentDeadline?: string;
    docketUrl: string;
    distanceMi: number;
  }>;
}

export const getActivePermits: DrylineTool<Input, ActivePermitsOutput> = {
  name: "get_active_permits",
  description:
    "Return recent water-related permit filings near a point — useful for transparency-mode users who want to know what's happening upstream of them.",
  inputSchema,
  run: async () => {
    return {
      data: null,
      caveats: [
        {
          severity: "warning",
          category: "quality",
          message:
            "get_active_permits is not yet implemented. See file header for ECHO + TCEQ integration notes.",
        },
      ],
      sources: [],
    };
  },
};
