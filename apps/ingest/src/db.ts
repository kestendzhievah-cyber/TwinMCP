import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@schema";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL[_UNPOOLED] is required");
}

// Workers do bulk writes — use direct connection, not PgBouncer transaction pool.
export const client = postgres(url, { max: 4, prepare: true });
export const db = drizzle(client, { schema });
export { schema };
