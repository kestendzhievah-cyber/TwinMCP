import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./core";
import { servers, userServers } from "./platform";

/**
 * Outcome of one MCP tool call through the proxy (contract D1):
 *  - ok            the MCP answered with a result
 *  - error         the MCP (or the relay to it) failed, or answered a JSON-RPC error
 *  - denied        refused before forwarding (key scope / server binding / tool policy)
 *  - rate_limited  refused by the daily quota or the per-minute limiter
 */
export const toolCallStatuses = ["ok", "error", "denied", "rate_limited"] as const;
export type ToolCallStatus = (typeof toolCallStatuses)[number];

/**
 * Per-call activity log (the server's Activity page). METADATA ONLY, by design
 * (GDPR / customer data): which tool on which MCP, when, how it ended and how
 * long it took — never the arguments nor the result.
 *
 * Retention is per plan (PLAN_CAPABILITIES.activityRetentionDays), applied at
 * read time and purged by /api/cron/purge (lib/activity/purge.ts).
 *
 * `api_key_id` deliberately has no FK: keys can be deleted while their history
 * must stay readable, and OAuth access-token ids (contract D4) land here too.
 * It is text because api_keys.id is text.
 */
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userServerId: text("user_server_id").references(() => userServers.id, {
      onDelete: "set null",
    }),
    mcpSlug: text("mcp_slug").notNull(),
    toolName: text("tool_name"),
    status: text("status").$type<ToolCallStatus>().notNull(),
    errorCode: integer("error_code"),
    latencyMs: integer("latency_ms"),
    requestId: text("request_id").notNull(),
    apiKeyId: text("api_key_id"),
    externalUserId: text("external_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Purge (per owner) and any per-account view.
    index("tool_calls_user_time_idx").on(t.userId, t.createdAt.desc()),
    // The server Activity page / API (newest first, cursor-paginated).
    index("tool_calls_server_time_idx").on(t.serverId, t.createdAt.desc()),
    // Retention purge: `created_at < cutoff` across every account.
    index("tool_calls_created_idx").on(t.createdAt),
  ]
);

export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
