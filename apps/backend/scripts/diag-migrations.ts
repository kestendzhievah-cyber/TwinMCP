/**
 * Read-only: is the prod DB schema migrated? Checks the bridge_port column
 * (added by 0005) and prints the drizzle applied-migrations journal.
 *
 * Usage: pnpm --filter @twinmcp/backend tsx scripts/diag-migrations.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const sql = postgres(url, { max: 1, ssl: "require" });

async function main() {
  const col = await sql`
    select 1 from information_schema.columns
    where table_name = 'user_servers' and column_name = 'bridge_port' limit 1`;
  console.log(`user_servers.bridge_port exists: ${col.length > 0 ? "YES ✅" : "NO ❌ (0005 not applied)"}`);

  const endpointCol = await sql`
    select 1 from information_schema.columns
    where table_name = 'user_servers' and column_name = 'endpoint_url' limit 1`;
  console.log(`user_servers.endpoint_url exists: ${endpointCol.length > 0 ? "YES ✅" : "NO ❌"}`);

  try {
    const rows = await sql`
      select hash, to_timestamp(created_at / 1000) as applied_at
      from drizzle."__drizzle_migrations" order by created_at`;
    console.log(`\napplied migrations (${rows.length}):`);
    for (const r of rows) console.log(`  ${r.applied_at?.toISOString?.() ?? r.applied_at}  ${String(r.hash).slice(0, 16)}`);
  } catch (err) {
    console.log(`\n(could not read drizzle.__drizzle_migrations: ${err instanceof Error ? err.message : err})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
