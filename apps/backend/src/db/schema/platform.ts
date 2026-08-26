import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./core";

export const hostTypes = ["upstash_box", "external_url", "local_agent"] as const;
export type HostType = (typeof hostTypes)[number];

export const serverStatuses = ["provisioning", "running", "stopped", "error", "destroyed"] as const;
export type ServerStatus = (typeof serverStatuses)[number];

export const boxSizes = ["small", "medium", "large"] as const;
export type BoxSize = (typeof boxSizes)[number];

export const mcpRuntimes = [
  "node",
  "node-alpine",
  "python",
  "python-alpine",
  "go",
  "golang-alpine",
  "ruby",
  "rust",
] as const;
export type McpRuntime = (typeof mcpRuntimes)[number];

// Where a catalog MCP runs: "box" = inside an Upstash Box (default), "local" =
// on the user's machine via the local agent (`ctx7 connect`) — e.g. desktop
// apps like Blender that expose a localhost socket the cloud box can't reach.
export const mcpHostModes = ["box", "local"] as const;
export type McpHostMode = (typeof mcpHostModes)[number];

export const servers = pgTable(
  "servers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    hostType: text("host_type").$type<HostType>().notNull().default("upstash_box"),
    boxId: text("box_id"),
    boxSize: text("box_size").$type<BoxSize>().notNull().default("small"),
    region: text("region"),
    endpointUrl: text("endpoint_url"),
    status: text("status").$type<ServerStatus>().notNull().default("provisioning"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("servers_user_slug_idx").on(t.userId, t.slug),
    index("servers_user_idx").on(t.userId),
    index("servers_status_idx").on(t.status),
  ]
);

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    repoUrl: text("repo_url"),
    runtime: text("runtime").$type<McpRuntime>().notNull(),
    hostMode: text("host_mode").$type<McpHostMode>().notNull().default("box"),
    // Marketplace grouping (dev, data, web, creative, ai, utility, docs). Null =
    // uncategorized ("Other").
    category: text("category"),
    installCmd: text("install_cmd").notNull(),
    startCmd: text("start_cmd").notNull(),
    version: text("version").notNull().default("latest"),
    configSchema: jsonb("config_schema").notNull().default({}),
    publishedByUserId: text("published_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isOfficial: boolean("is_official").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mcp_servers_slug_idx").on(t.slug),
    index("mcp_servers_published_idx").on(t.publishedByUserId),
    index("mcp_servers_public_idx").on(t.isPublic),
  ]
);

export const userServers = pgTable(
  "user_servers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    mcpServerId: text("mcp_server_id")
      .notNull()
      .references(() => mcpServers.id, { onDelete: "restrict" }),
    configCiphertext: text("config_ciphertext").notNull().default(""),
    configIv: text("config_iv").notNull().default(""),
    configTag: text("config_tag").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    // Per-MCP HTTP bridge: the box's public URL for this MCP, the in-box port it
    // listens on, and the box bearer token (AES-256-GCM, never returned by the API).
    endpointUrl: text("endpoint_url"),
    bridgePort: integer("bridge_port"),
    endpointTokenCiphertext: text("endpoint_token_ciphertext").notNull().default(""),
    endpointTokenIv: text("endpoint_token_iv").notNull().default(""),
    endpointTokenTag: text("endpoint_token_tag").notNull().default(""),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_servers_server_mcp_idx").on(t.serverId, t.mcpServerId),
    index("user_servers_user_idx").on(t.userId),
    index("user_servers_server_idx").on(t.serverId),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_user_time_idx").on(t.userId, t.createdAt),
    // Global recent-activity sort (admin) — the composite can't serve a
    // created_at-only ORDER BY.
    index("audit_logs_created_idx").on(t.createdAt),
  ]
);

export const usageMetrics = pgTable(
  "usage_metrics",
  {
    id: text("id").primaryKey(),
    userServerId: text("user_server_id")
      .notNull()
      .references(() => userServers.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    tokensUsed: integer("tokens_used").notNull().default(0),
    errorsCount: integer("errors_count").notNull().default(0),
  },
  (t) => [
    index("usage_metrics_us_period_idx").on(t.userServerId, t.periodStart),
    uniqueIndex("usage_metrics_us_period_unique").on(t.userServerId, t.periodStart),
    // Period-only range for admin/global analytics scans.
    index("usage_metrics_period_idx").on(t.periodStart),
  ]
);

export type Server = typeof servers.$inferSelect;
export type McpServer = typeof mcpServers.$inferSelect;
export type UserServer = typeof userServers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type UsageMetric = typeof usageMetrics.$inferSelect;
