// Secrets vault CRUD (contract D6). Values go in encrypted and never come back
// out of this module except through lib/vault/resolve.ts at provisioning time.
import { and, asc, count, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { userSecrets } from "@/db/schema/vault";
import { mcpServers, servers, userServers } from "@/db/schema/platform";
import { decryptConfig, encryptConfig } from "@/lib/crypto/config-encryption";
import { secretUsageFromConfigs, type InstallForUsage, type SecretUsage } from "./usage";

/**
 * Abuse cap on stored secrets per account (not a plan feature: the vault is
 * available on every plan). Generous next to the configs one account can hold.
 */
export const MAX_SECRETS_PER_USER = 200;

export interface SecretSummary {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

const summaryColumns = {
  id: userSecrets.id,
  name: userSecrets.name,
  createdAt: userSecrets.createdAt,
  updatedAt: userSecrets.updatedAt,
  lastUsedAt: userSecrets.lastUsedAt,
};

export async function listSecrets(userId: string): Promise<SecretSummary[]> {
  return getDb()
    .select(summaryColumns)
    .from(userSecrets)
    .where(eq(userSecrets.userId, userId))
    .orderBy(asc(userSecrets.name));
}

export async function getSecret(userId: string, name: string): Promise<SecretSummary | null> {
  const [row] = await getDb()
    .select(summaryColumns)
    .from(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.name, name)))
    .limit(1);
  return row ?? null;
}

export type CreateSecretResult =
  | { ok: true; secret: SecretSummary }
  | { ok: false; reason: "exists" | "limit" };

export async function createSecret(
  userId: string,
  name: string,
  value: string
): Promise<CreateSecretResult> {
  const db = getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(userSecrets)
    .where(eq(userSecrets.userId, userId));
  if (Number(n) >= MAX_SECRETS_PER_USER) return { ok: false, reason: "limit" };

  const [row] = await db
    .insert(userSecrets)
    .values({ userId, name, valueEncrypted: encryptConfig(value) })
    .onConflictDoNothing({ target: [userSecrets.userId, userSecrets.name] })
    .returning(summaryColumns);
  if (!row) return { ok: false, reason: "exists" };
  return { ok: true, secret: row };
}

export async function updateSecretValue(
  userId: string,
  name: string,
  value: string
): Promise<SecretSummary | null> {
  const [row] = await getDb()
    .update(userSecrets)
    .set({ valueEncrypted: encryptConfig(value), updatedAt: new Date() })
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.name, name)))
    .returning(summaryColumns);
  return row ?? null;
}

export async function deleteSecret(userId: string, name: string): Promise<boolean> {
  const rows = await getDb()
    .delete(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.name, name)))
    .returning({ id: userSecrets.id });
  return rows.length > 0;
}

/**
 * name → the user's installed MCPs whose config references it. Decrypts every
 * config of the account (an undecryptable one is skipped); only names and
 * config keys come out, never values.
 */
export async function findSecretUsage(userId: string): Promise<Map<string, SecretUsage[]>> {
  const rows = await getDb()
    .select({
      userServerId: userServers.id,
      serverId: servers.id,
      serverName: servers.name,
      serverSlug: servers.slug,
      mcpSlug: mcpServers.slug,
      mcpName: mcpServers.name,
      enabled: userServers.enabled,
      configCiphertext: userServers.configCiphertext,
      configIv: userServers.configIv,
      configTag: userServers.configTag,
    })
    .from(userServers)
    .innerJoin(servers, eq(servers.id, userServers.serverId))
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(and(eq(userServers.userId, userId), ne(servers.status, "destroyed")));

  const installs: InstallForUsage[] = [];
  for (const { configCiphertext, configIv, configTag, ...meta } of rows) {
    if (!configCiphertext) continue;
    let config: Record<string, unknown>;
    try {
      config = decryptConfig<Record<string, unknown>>({
        ciphertext: configCiphertext,
        iv: configIv,
        tag: configTag,
      });
    } catch {
      continue;
    }
    installs.push({ ...meta, config });
  }
  return secretUsageFromConfigs(installs);
}
