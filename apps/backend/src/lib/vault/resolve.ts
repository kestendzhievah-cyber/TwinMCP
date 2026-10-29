// Server-side resolution of `{{secret:NAME}}` references (contract D6).
// Called when an MCP's env is built (lib/provisioning.ts: provision, install,
// reconfigure). Plaintext values exist only in the returned config, which goes
// straight into the box launcher; nothing here logs a value.
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { userSecrets } from "@/db/schema/vault";
import { decryptConfig } from "@/lib/crypto/config-encryption";
import {
  collectSecretRefs,
  isValidSecretName,
  missingSecretsMessage,
  substituteSecretRefs,
} from "./refs";

export {
  collectSecretRefs,
  missingSecretsMessage,
  parseSecretRef,
  secretRef,
  substituteSecretRefs,
} from "./refs";

/** Thrown by callers that refuse to start an MCP with unresolved references. */
export class MissingSecretError extends Error {
  readonly names: string[];
  constructor(names: string[]) {
    super(missingSecretsMessage(names));
    this.name = "MissingSecretError";
    this.names = names;
  }
}

export interface ResolveOptions {
  /** Record the resolution in last_used_at (default true; false for pre-checks). */
  touch?: boolean;
}

/**
 * Replace every `{{secret:NAME}}` in `config` with the user's stored value.
 * `missing` lists names that are invalid, unknown or undecryptable (their
 * placeholders are left in `config`, so callers must refuse to use it when
 * `missing` is non-empty). A config without references costs no query.
 */
export async function resolveSecretRefs<T extends Record<string, unknown>>(
  userId: string,
  config: T,
  opts: ResolveOptions = {}
): Promise<{ config: T; missing: string[] }> {
  const refs = collectSecretRefs(config);
  if (refs.length === 0) return { config, missing: [] };

  const names = refs.filter(isValidSecretName);
  const lookup = new Map<string, string>();
  const idByName = new Map<string, string>();
  if (names.length > 0) {
    const rows = await getDb()
      .select({ id: userSecrets.id, name: userSecrets.name, value: userSecrets.valueEncrypted })
      .from(userSecrets)
      .where(and(eq(userSecrets.userId, userId), inArray(userSecrets.name, names)));
    for (const row of rows) {
      try {
        const plain = decryptConfig<unknown>(row.value);
        lookup.set(row.name, typeof plain === "string" ? plain : String(plain));
        idByName.set(row.name, row.id);
      } catch (err) {
        // A value we cannot decrypt (rotated key, corrupt row) counts as missing.
        console.error(`[vault] could not decrypt secret ${row.name} of user ${userId}:`, err);
      }
    }
  }

  const { value, missing, used } = substituteSecretRefs(config, lookup);

  if (opts.touch !== false && used.length > 0) {
    const ids = used.map((n) => idByName.get(n)).filter((id): id is string => !!id);
    // Fire-and-forget: a failed timestamp must not block an MCP from starting.
    void Promise.resolve()
      .then(() =>
        getDb()
          .update(userSecrets)
          .set({ lastUsedAt: new Date() })
          .where(and(eq(userSecrets.userId, userId), inArray(userSecrets.id, ids)))
      )
      .catch((err) => console.error("[vault] last_used_at update failed:", err));
  }

  return { config: value, missing };
}

/**
 * Resolve or throw MissingSecretError. The convenient form for code that must
 * never start an MCP with a literal placeholder in its env.
 */
export async function resolveSecretRefsOrThrow<T extends Record<string, unknown>>(
  userId: string,
  config: T
): Promise<T> {
  const { config: resolved, missing } = await resolveSecretRefs(userId, config);
  if (missing.length > 0) throw new MissingSecretError(missing);
  return resolved;
}

/** Names referenced by `config` that the user does not have (no side effects). */
export async function findMissingSecrets(
  userId: string,
  config: Record<string, unknown>
): Promise<string[]> {
  const { missing } = await resolveSecretRefs(userId, config, { touch: false });
  return missing;
}
