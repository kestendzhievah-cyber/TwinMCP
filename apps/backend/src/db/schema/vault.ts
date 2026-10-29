import { pgTable, text, timestamp, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import type { EncryptedPayload } from "../../lib/crypto/config-encryption";
import { users } from "./core";

// Secrets vault (contract D6). A user stores a value once under a NAME and MCP
// configs reference it as `{{secret:NAME}}` (lib/vault/refs.ts); the reference
// is resolved server-side when an MCP's env is built (lib/provisioning.ts), so
// the plaintext only ever lives in the box's launcher env, never in a config
// row twice. The value is AES-256-GCM encrypted (lib/crypto) and is never
// returned by any API: only names, timestamps and where a secret is used.
export const userSecrets = pgTable(
  "user_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // [A-Z0-9_]{1,64}, unique per user (lib/vault/refs.ts SECRET_NAME_RE).
    name: text("name").notNull(),
    // { ciphertext, iv, tag } from encryptConfig(value).
    valueEncrypted: jsonb("value_encrypted").$type<EncryptedPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Last time a provisioning/install resolved this secret into an MCP's env.
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("user_secrets_user_name_idx").on(t.userId, t.name),
    index("user_secrets_user_idx").on(t.userId),
  ]
);

export type UserSecretRow = typeof userSecrets.$inferSelect;
