import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { randomUUID } from "crypto";
import { hashKey, generateApiKey } from "../src/lib/auth";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = postgres(url, { max: 1, ssl: "require" });
const db = drizzle(client, { schema });

async function main() {
  console.log("[seed] creating test user…");
  const userId = "test-user-" + randomUUID().slice(0, 8);
  await db.insert(schema.users).values({
    id: userId,
    email: "test@twinmcp.local",
    plan: "pro",
  });

  console.log("[seed] creating API key…");
  const { raw, prefix, hash } = generateApiKey();
  await db.insert(schema.apiKeys).values({
    id: randomUUID(),
    userId,
    keyHash: hash,
    prefix,
    name: "seed-key",
  });
  console.log(`[seed] API key: ${raw}`);

  console.log("[seed] creating test library…");
  await db
    .insert(schema.libraries)
    .values({
      id: "/test/example-lib",
      title: "test/example-lib",
      description: "A test library for development",
      trustScore: 7.5,
      totalSnippets: 3,
      status: "ready",
      lastIndexedAt: new Date(),
    })
    .onConflictDoNothing();

  console.log("[seed] creating test teamspace…");
  const tsId = randomUUID();
  await db.insert(schema.teamspaces).values({ id: tsId, ownerId: userId, name: "Test Team" });
  await db.insert(schema.teamspaceMembers).values({ teamspaceId: tsId, userId, role: "owner" });

  console.log("[seed] done!");
  console.log(`  User ID:  ${userId}`);
  console.log(`  API Key:  ${raw}`);
  console.log(`  Team ID:  ${tsId}`);
}

main()
  .catch(console.error)
  .finally(() => client.end());
