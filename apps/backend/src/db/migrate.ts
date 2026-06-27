import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  process.exit(1);
}

const MIGRATIONS_FOLDER = "./src/db/migrations";

const client = postgres(url, { max: 1 });
const db = drizzle(client);

// Required Postgres extensions. NOT part of the Drizzle journal (so the migrator
// skips the file), but every generated migration depends on them. Idempotent —
// safe to run on every deploy, before the migrator.
const extensionsSql = readFileSync(`${MIGRATIONS_FOLDER}/0000_init_extensions.sql`, "utf8");
await client.unsafe(extensionsSql);
console.log("extensions ensured (vector, pg_trgm)");

await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
await client.end();
console.log("migrations applied");
