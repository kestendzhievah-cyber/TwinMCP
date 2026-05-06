import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers } from "@/db/schema/platform";
import { apiKeys } from "@/db/schema/core";
import type { Server, UserServer } from "@/db/schema/platform";
import type { ApiKey } from "@/db/schema/core";

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(resource: string) {
    super(`Access denied to ${resource}`);
    this.name = "ForbiddenError";
  }
}

export async function assertServerOwnership(
  userId: string,
  serverId: string
): Promise<Server> {
  const rows = await getDb().select().from(servers).where(eq(servers.id, serverId)).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("server");
  if (row.userId !== userId) throw new ForbiddenError("server");
  return row;
}

export async function assertUserServerOwnership(
  userId: string,
  userServerId: string
): Promise<UserServer> {
  const rows = await getDb()
    .select()
    .from(userServers)
    .where(eq(userServers.id, userServerId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("user_server");
  if (row.userId !== userId) throw new ForbiddenError("user_server");
  return row;
}

export async function assertApiKeyOwnership(
  userId: string,
  apiKeyId: string
): Promise<ApiKey> {
  const rows = await getDb().select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("api_key");
  if (row.userId !== userId) throw new ForbiddenError("api_key");
  return row;
}
