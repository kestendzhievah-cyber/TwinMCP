import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _client = postgres(url, {
    prepare: false, // required for Supabase pooler (PgBouncer transaction mode)
    // A real pool — one long-lived container, multiplexed onto backends by the
    // Supabase pooler (transaction mode). max:1 serialized every query in the
    // whole process (and silently defeated every Promise.all); keep this under
    // the pooler's per-role client budget. Tune with DB_POOL_MAX.
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
