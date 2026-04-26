import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";

export const API_KEY_PREFIX = "ctx7sk_";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("hex"); // 48 chars
  const raw = `${API_KEY_PREFIX}${secret}`;
  const prefix = raw.slice(0, 12); // "ctx7sk_" + 5 chars — safe to show in UI
  return { raw, prefix, hash: hashKey(raw) };
}

export interface AuthedContext {
  userId: string;
  apiKeyId: string;
  plan: "free" | "pro" | "team";
}

export async function authenticateRequest(req: Request): Promise<AuthedContext | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  if (!raw.startsWith(API_KEY_PREFIX)) return null;

  const db = getDb();
  const keyHash = hashKey(raw);
  const rows = await db
    .select({
      apiKeyId: apiKeys.id,
      userId: apiKeys.userId,
      revokedAt: apiKeys.revokedAt,
      plan: users.plan,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  const row = rows[0];
  if (!row || row.revokedAt) return null;

  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.apiKeyId))
    .catch(() => {});

  return { userId: row.userId, apiKeyId: row.apiKeyId, plan: row.plan };
}
