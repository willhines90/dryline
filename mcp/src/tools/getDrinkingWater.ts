/**
 * get_drinking_water — public water system info + recent SDWIS violations.
 *
 * Source: EPA SDWIS via ECHO (preferred over TCEQ DWW because ECHO has APIs).
 * Endpoints to use:
 *   - https://echodata.epa.gov/echo/sdw_rest_services.get_systems
 *   - https://echodata.epa.gov/echo/sdw_rest_services.get_violations
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - Resolve the PWS for an address via service area boundary lookup, OR accept
 *   pwsId directly if resolve_location populated it.
 * - List violations from the last 5 years.
 * - Don't dramatize: a "violation" can be paperwork (e.g. monitoring & reporting)
 *   not a contamination event. Surface the violation type clearly.
 * - Caveat: EPA acknowledges 3–6 month reporting lag.
 */

import { z } from "zod";
import type { DrylineTool } from "../types.js";

const inputSchema = z.object({
  pwsId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
}).refine(v => !!v.pwsId || (v.lat !== undefined && v.lng !== undefined), {
  message: "Provide either pwsId or both lat and lng.",
});

type Input = z.infer<typeof inputSchema>;

interface DrinkingWaterOutput {
  pwsId: string;
  pwsName: string;
  populationServed: number;
  sourceWaterType: "GW" | "SW" | "GU" | "SU" | "GWP" | "SWP";
  recentViolations: Array<{
    violationCode: string;
    violationCategory: string;
    contaminant?: string;
    beginDate: string;
    endDate?: string;
    isHealthBased: boolean;
  }>;
}

export const getDrinkingWater: DrylineTool<Input, DrinkingWaterOutput> = {
  name: "get_drinking_water",
  description:
    "Return the public water system that serves this location, plus its recent Safe Drinking Water Act violations from EPA SDWIS. Distinguishes health-based violations from procedural ones.",
  inputSchema,
  run: async () => {
    return {
      data: null,
      caveats: [
        {
          severity: "warning",
          category: "quality",
          message:
            "get_drinking_water is not yet implemented. See file header for EPA ECHO SDWIS integration notes.",
        },
      ],
      sources: [],
    };
  },
};
