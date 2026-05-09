/**
 * DuckDB snapshot loader.
 *
 * Snapshot sources (load once at server start; refresh via npm script):
 *   - TWDB GWDB pipe-delimited dumps     → table: gw_wells, gw_levels
 *   - TNRIS Floodplain Quilt (GeoJSON)   → table: floodplain (with R-tree)
 *   - TNRIS StratMap parcels (per county)→ table: parcels
 *   - TWDB GCD list                      → table: gcds
 *   - TWDB reservoir master list         → table: reservoirs
 *
 * IMPLEMENTATION NOTES (Claude Code: fill this in)
 * - Use duckdb-async for promise-friendly Node bindings.
 * - Load on startup; keep a singleton DB connection.
 * - Each loader function: idempotent, checks if table exists with non-zero rows.
 * - Gate snapshot fetch behind a `pnpm run snapshots:fetch` script that
 *   downloads fresh data and writes to ./data/snapshots/ (gitignored).
 */

import { Database } from "duckdb-async";

let dbInstance: Database | null = null;

/**
 * Lazily open the DuckDB instance. Path is configurable via DRYLINE_DUCKDB_PATH.
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  const path = process.env.DRYLINE_DUCKDB_PATH ?? "./mcp/data/dryline.duckdb";
  dbInstance = await Database.create(path);
  await ensureSchema(dbInstance);
  return dbInstance;
}

async function ensureSchema(db: Database): Promise<void> {
  // Stub schema; expand as snapshots get loaded.
  await db.all(`
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
