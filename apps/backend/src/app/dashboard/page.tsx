import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { apiKeys, usageEvents, users } from "@/db/schema";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { getDailyLimit } from "@/lib/rate-limit";
import { ApiKeysPanel } from "./api-keys-panel";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();

  const [userRow] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const plan = userRow?.plan ?? "free";

  const keys = await db
    .select({
      id: apiKeys.id,
      prefix: apiKeys.prefix,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));

  const dayAgo = new Date(Date.now() - 86_400_000);
  const [usageCount] = await db
    .select({ n: count() })
    .from(usageEvents)
    .where(and(eq(usageEvents.userId, user.id), gte(usageEvents.timestamp, dayAgo)));

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: "#666", marginBottom: "2rem", fontSize: "0.875rem" }}>
        Plan: <strong>{plan}</strong> &middot; Usage today: {usageCount?.n ?? 0} /{" "}
        {getDailyLimit(plan)}
      </p>

      <ApiKeysPanel
        keys={keys.map((k) => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
