import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "../src/db/schema";
// The catalogue itself (entries, retired slugs, categories) lives in a pure
// module shared with the public /servers pages, so the site and the database
// are built from the same data.
import { CATEGORY, OFFICIAL_MCPS, RETIRED_SLUGS } from "../src/lib/servers/seed-catalog";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = postgres(url, { max: 1, ssl: "require" });
const db = drizzle(client, { schema });

async function main() {
  console.log(`[seed] upserting ${OFFICIAL_MCPS.length} official MCPs…`);
  for (const m of OFFICIAL_MCPS) {
    await db
      .insert(schema.mcpServers)
      .values({
        id: randomUUID(),
        slug: m.slug,
        name: m.name,
        description: m.description,
        repoUrl: m.repoUrl ?? null,
        runtime: m.runtime,
        installCmd: m.installCmd,
        startCmd: m.startCmd,
        version: m.version,
        configSchema: m.configSchema,
        hostMode: m.hostMode ?? "box",
        category: m.category ?? CATEGORY[m.slug] ?? null,
        isOfficial: true,
        isPublic: true,
      })
      // Upsert so re-seeding actually updates install/start/version on existing rows.
      .onConflictDoUpdate({
        target: schema.mcpServers.slug,
        set: {
          name: m.name,
          description: m.description,
          repoUrl: m.repoUrl ?? null,
          runtime: m.runtime,
          installCmd: m.installCmd,
          startCmd: m.startCmd,
          version: m.version,
          configSchema: m.configSchema,
          hostMode: m.hostMode ?? "box",
          category: m.category ?? CATEGORY[m.slug] ?? null,
          isOfficial: true,
          isPublic: true,
        },
      });
    console.log(`  ✓ ${m.slug}@${m.version}`);
  }

  // Hide deprecated/archived official entries from the catalog (keep rows for FK).
  const retired = await db
    .update(schema.mcpServers)
    .set({ isPublic: false })
    .where(
      and(inArray(schema.mcpServers.slug, RETIRED_SLUGS), eq(schema.mcpServers.isOfficial, true))
    )
    .returning({ slug: schema.mcpServers.slug });
  for (const r of retired) console.log(`  ⊘ unpublished deprecated ${r.slug}`);

  console.log("[seed] done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
