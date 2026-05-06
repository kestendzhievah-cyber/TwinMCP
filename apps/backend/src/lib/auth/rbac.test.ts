import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import * as schema from "@/db/schema";
import {
  assertServerOwnership,
  assertUserServerOwnership,
  assertApiKeyOwnership,
  ForbiddenError,
  NotFoundError,
} from "./rbac";

// Integration tests require a real Postgres. Set TEST_DATABASE_URL to enable.
// Example: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/test
const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("rbac (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  const userA = `usr_${randomBytes(8).toString("hex")}`;
  const userB = `usr_${randomBytes(8).toString("hex")}`;

  beforeAll(async () => {
    client = postgres(TEST_DB!, { max: 1 });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Re-seed two users for each test
    await db.delete(schema.users).where(inArray(schema.users.id, [userA, userB]));
    await db
      .insert(schema.users)
      .values([
        { id: userA, email: `${userA}@test.local` },
        { id: userB, email: `${userB}@test.local` },
      ])
      .onConflictDoNothing();
  });

  it("assertServerOwnership: owner can read", async () => {
    const serverId = `srv_${randomBytes(8).toString("hex")}`;
    await db.insert(schema.servers).values({
      id: serverId,
      userId: userA,
      name: "test",
      slug: "test",
    });
    const result = await assertServerOwnership(userA, serverId);
    expect(result.id).toBe(serverId);
  });

  it("assertServerOwnership: non-owner gets ForbiddenError", async () => {
    const serverId = `srv_${randomBytes(8).toString("hex")}`;
    await db.insert(schema.servers).values({
      id: serverId,
      userId: userA,
      name: "test",
      slug: "test-2",
    });
    await expect(assertServerOwnership(userB, serverId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("assertServerOwnership: missing server gets NotFoundError", async () => {
    await expect(assertServerOwnership(userA, "srv_nonexistent")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("assertApiKeyOwnership: non-owner cannot access another user's key", async () => {
    const keyId = `key_${randomBytes(8).toString("hex")}`;
    await db.insert(schema.apiKeys).values({
      id: keyId,
      userId: userA,
      keyHash: randomBytes(32).toString("hex"),
      prefix: "ctx7sk_aaaaa",
    });
    await expect(assertApiKeyOwnership(userB, keyId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
