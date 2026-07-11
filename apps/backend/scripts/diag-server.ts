/**
 * Read-only diagnostic for a server stuck in `error`. Prints each server's plan,
 * status, box size, whether a box was actually created, its installed MCPs, and
 * the live box status from Upstash. No writes.
 *
 * Usage:
 *   UPSTASH_BOX_API_KEY=box_... pnpm --filter @twinmcp/backend tsx scripts/diag-server.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import postgres from "postgres";
import { getBoxClient } from "../src/lib/upstash/box-client";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const sql = postgres(url, { max: 1, ssl: "require" });

async function main() {
  const servers = await sql`
    select s.id, s.name, s.slug, s.box_id, s.box_size, s.status, s.region,
           (s.endpoint_url is not null) as has_endpoint, s.last_heartbeat_at,
           s.created_at, s.user_id, u.plan
    from servers s join users u on u.id = s.user_id
    order by s.created_at desc`;

  console.log(`=== ${servers.length} server(s) ===\n`);
  for (const s of servers) {
    console.log(`• ${s.name} (${s.slug})`);
    console.log(`    plan=${s.plan}  status=${s.status}  size=${s.box_size}  region=${s.region ?? "—"}`);
    console.log(`    boxId=${s.box_id ?? "(none — createBox never succeeded)"}`);
    console.log(`    endpointUrl set=${s.has_endpoint}  lastHeartbeat=${s.last_heartbeat_at ?? "never"}`);
    console.log(`    created=${s.created_at}`);

    const mcps = await sql`
      select m.slug, m.runtime, us.enabled, us.bridge_port,
             (us.endpoint_url is not null) as has_ep
      from user_servers us join mcp_servers m on m.id = us.mcp_server_id
      where us.server_id = ${s.id as string}`;
    if (mcps.length === 0) console.log(`    MCPs: none installed`);
    for (const m of mcps) {
      console.log(`    MCP ${m.slug} (${m.runtime}) enabled=${m.enabled} port=${m.bridge_port ?? "—"} endpoint=${m.has_ep}`);
    }

    if (s.box_id) {
      try {
        const status = await getBoxClient().getStatus(s.box_id as string);
        console.log(`    → live box status (Upstash): ${status}`);
      } catch (err) {
        console.log(`    → live box status ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
