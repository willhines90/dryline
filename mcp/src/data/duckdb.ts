/**
 * DuckDB snapshot loader — OPTIONAL.
 *
 * `duckdb-async` is an optional dependency. The native binding install can be
 * slow (or fail in some sandboxed environments). The MCP server boots without
 * it; tools that need DuckDB call `getDb()` and surface a warning Caveat if
 * `null` is returned.
 *
 * Snapshot sources (load once at server start; refresh via npm script):
 *   - TWDB GWDB pipe-delimited dumps     → table: gw_wells, gw_levels
 *   - TNRIS Floodplain Quilt (GeoJSON)   → table: floodplain (with R-tree)
 *   - TNRIS StratMap parcels (per county)→ table: parcels
 *   - TWDB GCD list                      → table: gcds
 *   - TWDB reservoir master list         → table: reservoirs
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - Loader functions: idempotent, check if table exists with non-zero rows.
 * - Gate snapshot fetch behind `pnpm run snapshots:fetch` (download then load).
 */

// Local type alias — avoids hard-coding the duckdb-async import at type level
// so the file typechecks even when the optional dep isn't installed.
type Db = unknown;

let dbInstance: Db | null = null;
let initAttempted = false;

/**
 * Lazily open the DuckDB instance. Returns null if duckdb-async is not
 * installed or initialization fails — callers must handle null and add an
 * appropriate Caveat to their ToolResult.
 */
export async function getDb(): Promise<Db | null> {
  if (dbInstance) return dbInstance;
  if (initAttempted) return null; // don't retry on every call
  initAttempted = true;

  try {
    // Dynamic import: errors here are expected when the optional dep is absent.
    const mod = (await import("duckdb-async")) as {
      Database: { create: (path: string) => Promise<Db> };
    };
    const path = process.env.DRYLINE_DUCKDB_PATH ?? "./mcp/data/dryline.duckdb";
    dbInstance = await mod.Database.create(path);
    await ensureSchema(dbInstance);
    return dbInstance;
  } catch (err) {
    process.stderr.write(
      `[dryline] DuckDB unavailable; snapshot-backed tools will return warnings. Reason: ${
        err instanceof Error ? err.message : String(err)
      }\n`
    );
    return null;
  }
}

async function ensureSchema(db: Db): Promise<void> {
  // Stub schema; expand as snapshots get loaded.
  // Cast through `any` because we deliberately decline to type the Database
  // surface here — duckdb-async is optional. Tools that depend on this should
  // add their own typed wrappers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = db as any;
  await conn.all?.(`
    CREATE TABLE IF NOT EXISTS reservoirs (
      name TEXT PRIMARY KEY,
      lat DOUBLE,
      lng DOUBLE,
      conservation_capacity_acft DOUBLE
    );
    CREATE TABLE IF NOT EXISTS gcds (
      slug TEXT PRIMARY KEY,
      name TEXT,
      county_fips TEXT,
      website TEXT
    );
  `);
}

/**
 * Helper for tools: returns a ready-to-merge Caveat when DuckDB is unavailable.
 */
export function duckdbUnavailableCaveat() {
  return {
    severity: "warning" as const,
    category: "quality" as const,
    message:
      "Snapshot data unavailable: DuckDB optional dependency not installed. Run `pnpm install` (with --no-ignore-scripts) to enable.",
  };
}
