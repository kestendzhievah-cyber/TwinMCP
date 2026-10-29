import { pgTable, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./core";
import { servers } from "./platform";

// OAuth 2.1 for remote MCP connectors (Claude, ChatGPT, Cursor…) — contract D4.
// lib/oauth.ts is the only writer. Codes and tokens are stored as SHA-256
// hashes, never in plain text: a database leak yields nothing replayable.
// Migration: 0017_oauth.sql (hand-written, idempotent).

/** Dynamic client registrations (RFC 7591). Public clients only (PKCE S256). */
export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The public client_id handed to the connector ("tmcp_client_…"). */
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    /** Exact-match list (loopback http may vary its port, RFC 8252 §7.3). */
    redirectUris: text("redirect_uris")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Optional homepage the client declared — shown as text, never fetched. */
    clientUri: text("client_uri"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("oauth_clients_client_id_idx").on(t.clientId),
    index("oauth_clients_created_idx").on(t.createdAt),
  ]
);

/** Authorization codes: ≤ 60 s, single use (used_at), bound to a PKCE challenge. */
export const oauthCodes = pgTable(
  "oauth_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The one server the connector may reach; null = all of the user's servers. */
    serverId: text("server_id").references(() => servers.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    scope: text("scope").notNull().default("mcp"),
    /** RFC 8707 resource indicator sent with the authorization request, if any. */
    resource: text("resource"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** The token family the code was exchanged for (revoked if the code is replayed). */
    familyId: uuid("family_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("oauth_codes_hash_idx").on(t.codeHash),
    index("oauth_codes_expires_idx").on(t.expiresAt),
  ]
);

/**
 * One row per issued access + refresh pair. A refresh rotates: the row gets
 * rotated_at and a new row joins the same family_id. Presenting a rotated
 * refresh token again is reuse — the whole family is revoked. A family is what
 * the dashboard calls an "authorized connector".
 */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: text("server_id").references(() => servers.id, { onDelete: "cascade" }),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    scope: text("scope").notNull().default("mcp"),
    resource: text("resource"),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    /** When the user consented (copied along the family on every rotation). */
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("oauth_tokens_access_hash_idx").on(t.accessTokenHash),
    uniqueIndex("oauth_tokens_refresh_hash_idx").on(t.refreshTokenHash),
    index("oauth_tokens_family_idx").on(t.familyId),
    index("oauth_tokens_user_idx").on(t.userId),
  ]
);

export type OAuthClient = typeof oauthClients.$inferSelect;
export type OAuthCode = typeof oauthCodes.$inferSelect;
export type OAuthToken = typeof oauthTokens.$inferSelect;
