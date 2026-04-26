import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  index,
  uniqueIndex,
  vector,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const plans = ["free", "pro", "team"] as const;
export type Plan = (typeof plans)[number];

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // Clerk user_id
    email: text("email").notNull(),
    plan: text("plan").$type<Plan>().notNull().default("free"),
    quotaUsed: integer("quota_used").notNull().default(0),
    quotaResetAt: timestamp("quota_reset_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(), // e.g. ctx7sk_abc1
    name: text("name"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.keyHash), index("api_keys_user_idx").on(t.userId)]
);

export const teamspaces = pgTable("teamspaces", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  plan: text("plan").$type<Plan>().notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamspaceMembers = pgTable(
  "teamspace_members",
  {
    teamspaceId: text("teamspace_id")
      .notNull()
      .references(() => teamspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamspaceId, t.userId] })]
);

export const teamspaceFilters = pgTable("teamspace_filters", {
  teamspaceId: text("teamspace_id")
    .primaryKey()
    .references(() => teamspaces.id, { onDelete: "cascade" }),
  minTrustScore: real("min_trust_score").notNull().default(0),
  blockedLibraryIds: text("blocked_library_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
});

export const libraryStatus = ["pending", "indexing", "ready", "failed"] as const;
export type LibraryStatus = (typeof libraryStatus)[number];

export const libraries = pgTable(
  "libraries",
  {
    id: text("id").primaryKey(), // e.g. /vercel/next.js
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    repoUrl: text("repo_url"),
    sourceUrl: text("source_url"),
    trustScore: real("trust_score").notNull().default(0),
    benchmarkScore: real("benchmark_score"),
    totalSnippets: integer("total_snippets").notNull().default(0),
    versions: text("versions")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    status: text("status").$type<LibraryStatus>().notNull().default("pending"),
    isPrivate: boolean("is_private").notNull().default(false),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("libraries_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
    index("libraries_trust_idx").on(t.trustScore),
  ]
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    version: text("version").notNull().default("latest"),
    path: text("path").notNull(),
    rawContent: text("raw_content").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_lib_idx").on(t.libraryId)]
);

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    position: integer("position").notNull().default(0),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    index("chunks_embedding_idx")
      .using("hnsw", t.embedding.op("vector_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
    index("chunks_lib_idx").on(t.libraryId),
  ]
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    apiKeyId: text("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    endpoint: text("endpoint").notNull(),
    libraryId: text("library_id"),
    latencyMs: integer("latency_ms").notNull().default(0),
    statusCode: integer("status_code").notNull().default(200),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_user_time_idx").on(t.userId, t.timestamp),
    index("usage_endpoint_idx").on(t.endpoint),
  ]
);

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Library = typeof libraries.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
