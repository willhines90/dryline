/**
 * get_drinking_water — public water system info + SDWIS compliance status.
 *
 * Source: EPA ECHO SDWIS REST services.
 *   https://echodata.epa.gov/echo/sdw_rest_services.get_systems
 *   https://echodata.epa.gov/echo/sdw_rest_services.get_qid
 *
 * Two-step query: get_systems returns a QueryID + summary counts;
 * get_qid pages the actual WaterSystem rows. We surface health-based vs
 * procedural violations distinctly per the SDWIS taxonomy:
 *   - Health-based:        HealthFlag=Yes (MCL / MRDL / Treatment Technique)
 *   - Monitoring/Reporting: MrFlag=Yes
 *   - Public Notification:  PnFlag=Yes
 *   - Other:                OtherFlag=Yes
 *
 * EPA acknowledges a 3–6 month state→federal reporting lag; surfaced as a
 * freshness caveat. Per-violation begin/end dates are not in the ECHO
 * summary — the DfrUrl is the canonical drilldown.
 */

import { z } from "zod";
import type { Caveat, DrylineTool, Source } from "../types.js";
import { source, freshnessCaveat, errorCaveat, boundsCaveat } from "../lib/sources.js";

const PWS_ID_RE = /^[A-Z]{2}\d{7}$/;
const FIPS_RE = /^\d{5}$/;

const inputSchema = z
  .object({
    pwsId: z
      .string()
      .regex(PWS_ID_RE, "Expected SDWIS PWS ID like TX1050018")
      .optional(),
    countyFips: z
      .string()
      .regex(FIPS_RE, "Expected 5-digit county FIPS")
      .optional(),
    limit: z.number().int().min(1).max(20).default(5),
  })
  .refine((v) => !!v.pwsId || !!v.countyFips, {
    message: "Provide either pwsId or countyFips.",
  });

type Input = z.infer<typeof inputSchema>;

interface SdwisCompliance {
  seriousViolator: boolean;
  sncStatus: string | null;
  /** Current MCL / MRDL / Treatment Technique violation. */
  healthBasedCurrent: boolean;
  monitoringReportingCurrent: boolean;
  publicNotificationCurrent: boolean;
  otherCurrent: boolean;
  rulesViolatedLast3yr: number;
  openViolations: number;
  contaminantsInCurrentViolation: string[];
  contaminantsInViolation3yr: string[];
  violationCategories: string[];
}

interface DrinkingWaterSystem {
  pwsId: string;
  pwsName: string;
  populationServed: number;
  pwsTypeCode: string;
  pwsTypeDesc: string;
  sourceWaterCode: string;
  sourceWaterDesc: string;
  activityStatus: string;
  countiesServed: string | null;
  citiesServed: string | null;
  zipCodesServed: string | null;
  compliance: SdwisCompliance;
  detailedFacilityReportUrl: string | null;
}

interface DrinkingWaterOutput {
  systems: DrinkingWaterSystem[];
}

const ECHO_BASE = "https://echodata.epa.gov/echo";

async function echoJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    if (res.status < 500 || attempt === 1) {
      throw new Error(`ECHO ${res.status} for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`ECHO retries exhausted for ${url}`);
}

interface QuerySummary {
  Results: {
    Message?: string;
    Version?: string;
    QueryRows?: string;
    QueryID?: string;
    Error?: { ErrorMessage?: string };
  };
}

interface SystemRow {
  PWSId?: string;
  PWSName?: string;
  PopulationServedCount?: string;
  PWSTypeCode?: string;
  PWSTypeDesc?: string;
  PrimarySourceCode?: string;
  PrimarySourceDesc?: string;
  PWSActivityCode?: string;
  PWSActivityDesc?: string;
  CountiesServed?: string | null;
  CitiesServed?: string | null;
  ZipCodesServed?: string | null;
  SeriousViolator?: string;
  SNC?: string;
  HealthFlag?: string;
  MrFlag?: string;
  PnFlag?: string;
  OtherFlag?: string;
  RulesVio3yr?: string;
  Vioremain?: string;
  ViolationCategories?: string | null;
  SDWAContaminantsInCurViol?: string | null;
  SDWAContaminantsInViol3yr?: string | null;
  DfrUrl?: string | null;
}

interface RowsResponse {
  Results: {
    WaterSystems?: SystemRow[];
    Error?: { ErrorMessage?: string };
  };
}

function yes(v: string | undefined | null): boolean {
  return (v ?? "").toUpperCase() === "YES";
}

function num(v: string | undefined | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Parse "8000=Revised Total Coliform Rule | 9999=Other Rule" → human names. */
function parseContaminants(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(/\s*\|\s*/)
    .map((p) => {
      const eq = p.indexOf("=");
      return eq >= 0 ? p.slice(eq + 1).trim() : p.trim();
    })
    .filter(Boolean);
}

function parseCategories(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
}

function mapSystem(row: SystemRow): DrinkingWaterSystem {
  return {
    pwsId: row.PWSId ?? "",
    pwsName: row.PWSName ?? "",
    populationServed: num(row.PopulationServedCount),
    pwsTypeCode: row.PWSTypeCode ?? "",
    pwsTypeDesc: row.PWSTypeDesc ?? "",
    sourceWaterCode: row.PrimarySourceCode ?? "",
    sourceWaterDesc: row.PrimarySourceDesc ?? "",
    activityStatus: row.PWSActivityDesc ?? row.PWSActivityCode ?? "",
    countiesServed: row.CountiesServed ?? null,
    citiesServed: row.CitiesServed ?? null,
    zipCodesServed: row.ZipCodesServed ?? null,
    compliance: {
      seriousViolator: yes(row.SeriousViolator),
      sncStatus: row.SNC ?? null,
      healthBasedCurrent: yes(row.HealthFlag),
      monitoringReportingCurrent: yes(row.MrFlag),
      publicNotificationCurrent: yes(row.PnFlag),
      otherCurrent: yes(row.OtherFlag),
      rulesViolatedLast3yr: num(row.RulesVio3yr),
      openViolations: num(row.Vioremain),
      contaminantsInCurrentViolation: parseContaminants(row.SDWAContaminantsInCurViol),
      contaminantsInViolation3yr: parseContaminants(row.SDWAContaminantsInViol3yr),
      violationCategories: parseCategories(row.ViolationCategories),
    },
    detailedFacilityReportUrl: row.DfrUrl ?? null,
  };
}

export const getDrinkingWater: DrylineTool<Input, DrinkingWaterOutput> = {
  name: "get_drinking_water",
  description:
    "Return public water system(s) and Safe Drinking Water Act compliance status from EPA SDWIS via ECHO. Distinguishes health-based violations (MCL / MRDL / Treatment Technique) from procedural ones (monitoring & reporting, public notification). Pass pwsId for a single system, or countyFips to list the top-N active community water systems in that county by population served.",
  inputSchema,
  run: async (input) => {
    try {
      const { pwsId, countyFips, limit } = input as Input & { limit: number };

      const params = new URLSearchParams({ output: "JSON" });
      if (pwsId) {
        params.set("p_pid", pwsId);
      } else if (countyFips) {
        params.set("p_fips", countyFips);
        params.set("p_act", "Y");
      }

      const queryUrl = `${ECHO_BASE}/sdw_rest_services.get_systems?${params.toString()}`;
      const summary = await echoJson<QuerySummary>(queryUrl);
      const err = summary.Results?.Error?.ErrorMessage;
      if (err) throw new Error(`ECHO get_systems: ${err}`);
      const qid = summary.Results.QueryID;
      if (!qid) throw new Error("ECHO get_systems: missing QueryID");
      const version = summary.Results.Version ?? "SDWIS";
      const queryRows = num(summary.Results.QueryRows);

      let allRows: SystemRow[] = [];
      if (queryRows > 0) {
        const qrows = pwsId ? 1 : Math.min(queryRows, 500);
        const rowsUrl = `${ECHO_BASE}/sdw_rest_services.get_qid?qid=${encodeURIComponent(qid)}&output=JSON&qrows=${qrows}`;
        const rowsResp = await echoJson<RowsResponse>(rowsUrl);
        const rowsErr = rowsResp.Results?.Error?.ErrorMessage;
        if (rowsErr) throw new Error(`ECHO get_qid: ${rowsErr}`);
        allRows = rowsResp.Results?.WaterSystems ?? [];
      }

      // Single PWS lookup → first row. County listing → top-N CWS by population.
      let chosen: SystemRow[];
      let totalCwsInCounty = 0;
      if (pwsId) {
        chosen = allRows.slice(0, 1);
      } else {
        const cws = allRows.filter((r) => r.PWSTypeCode === "CWS");
        totalCwsInCounty = cws.length;
        chosen = cws
          .sort((a, b) => num(b.PopulationServedCount) - num(a.PopulationServedCount))
          .slice(0, limit);
      }

      const systems = chosen.map(mapSystem);

      const sources: Source[] = [
        source({
          title: pwsId
            ? `EPA ECHO SDWIS — ${pwsId}`
            : `EPA ECHO SDWIS — county FIPS ${countyFips}`,
          url: queryUrl,
          publisher: "U.S. EPA SDWIS via ECHO",
        }),
      ];
      for (const s of systems) {
        if (s.detailedFacilityReportUrl) {
          sources.push(
            source({
              title: `EPA ECHO Detailed Facility Report — ${s.pwsName} (${s.pwsId})`,
              url: s.detailedFacilityReportUrl,
              publisher: "U.S. EPA ECHO",
            }),
          );
        }
      }

      const caveats: Caveat[] = [
        freshnessCaveat({
          asOf: new Date().toISOString().slice(0, 10),
          cadence: `from EPA ECHO snapshot ${version}; SDWIS data refreshes quarterly`,
        }),
        {
          severity: "warning",
          category: "quality",
          message:
            "EPA acknowledges a 3–6 month state→federal reporting lag for SDWIS violations. Very recent compliance events may not yet appear.",
        },
        {
          severity: "info",
          category: "inference",
          message:
            "Health-based violations (MCL / MRDL / Treatment Technique) indicate exceedance of a safety limit. Monitoring & Reporting and Public Notification violations are procedural — important for accountability but do NOT by themselves imply contamination.",
        },
        boundsCaveat(
          "Per-violation begin/end dates are not in the ECHO summary; follow detailedFacilityReportUrl for the dated history per system.",
        ),
      ];

      if (!pwsId && countyFips) {
        caveats.push(
          boundsCaveat(
            `Listed the top ${systems.length} active community water systems by population served (of ${totalCwsInCounty} CWS in this county). Pass pwsId for a targeted system lookup.`,
          ),
        );
      }

      if (systems.length === 0) {
        caveats.push(
          boundsCaveat(
            pwsId
              ? `No SDWIS system matched ${pwsId}. The ID may be incorrect or the system may be outside ECHO's coverage.`
              : `No active community water systems found for FIPS ${countyFips}.`,
          ),
        );
      }

      return { data: { systems }, caveats, sources };
    } catch (err) {
      return {
        data: null,
        caveats: [errorCaveat(err, "get_drinking_water failed")],
        sources: [],
      };
    }
  },
};
