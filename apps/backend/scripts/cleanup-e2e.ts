// One-shot cleanup for ephemeral E2E test users.
// Run with: pnpm --filter @twinmcp/backend exec tsx scripts/cleanup-e2e.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const result = await sql`DELETE FROM users WHERE id LIKE 'e2e-%' RETURNING id`;
console.log(`Deleted ${result.length} test users:`);
for (const r of result) console.log(`  - ${r.id}`);
await sql.end();
