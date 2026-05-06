// Quick read-only probe — list MCPs in the catalog so the E2E script
// knows what to install.
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
const rows = await sql<{ id: string; slug: string; name: string; config_schema: unknown }[]>`
  SELECT id, slug, name, config_schema
  FROM mcp_servers
  WHERE is_official = true AND is_public = true
  ORDER BY created_at ASC
  LIMIT 10
`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
