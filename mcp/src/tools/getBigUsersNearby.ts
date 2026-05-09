/**
 * get_big_users_nearby — large permitted water users near a point.
 *
 * Source: EPA ECHO regulated facilities (proxies federal-reportable TCEQ data).
 * Endpoint: https://echodata.epa.gov/echo/cwa_rest_services.get_facilities
 *   (Clean Water Act facilities; includes industrial water dischargers)
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - For Dryline's water focus: filter to facilities with active SIC/NAICS codes
 *   in semiconductors, data centers, oil & gas, large food processing, etc.
 * - "Big" cutoff is contextual — surface raw permit volumes; let the agent
 *   decide what "big" means in context. Caveat: permit volume ≠ actual draw.
 * - Privacy: facility names are public; never surface individual private
 *   well owners or domestic users.
 */

import { z } from "zod";
import type { DrylineTool } from "../types.js";

const inputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusMi: z.number().min(1).max(50).default(15),
});

type Input = z.infer<typeof inputSchema>;

interface BigUsersOutput {
  facilities: Array<{
    name: string;
    permitId: string;
    type: string;
    industry?: string;
    permittedVolumeMgd?: number;
    distanceMi: number;
    lat: number;
    lng: number;
  }>;
}

export const getBigUsersNearby: DrylineTool<Input, BigUsersOutput> = {
  name: "get_big_users_nearby",
  description:
    "Find federally-reportable industrial / commercial water-permitted facilities within a radius. Useful for transparency-mode questions like 'who's drinking your aquifer?'",
  inputSchema,
  run: async () => {
    return {
      data: null,
      caveats: [
        {
          severity: "warning",
          category: "quality",
          message:
            "get_big_users_nearby is not yet implemented. See file header for EPA ECHO CWA integration notes.",
        },
      ],
      sources: [],
    };
  },
};
