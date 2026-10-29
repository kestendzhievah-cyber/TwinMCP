import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema/core";
import { oauthClients, oauthTokens } from "@/db/schema/oauth";
import { toolCalls, toolCallStatuses, type ToolCallStatus } from "@/db/schema/activity";
import { activityCutoff, activityRetentionDays } from "./retention";

/**
 * Reading the tool-call activity log: filter / cursor parsing (pure, tested)
 * and the paginated query used by both the API route and the dashboard page.
 *
 * Pagination is keyset on (created_at DESC, id DESC). The cursor carries the
 * created_at at MICROSECOND precision (Postgres resolution) — a JS Date would
 * truncate to milliseconds and skip or repeat rows written in the same ms.
 */

export const ACTIVITY_DEFAULT_LIMIT = 50;
export const ACTIVITY_MAX_LIMIT = 100;
const MAX_FILTER_LENGTH = 200;

export interface ActivityCursor {
  /** ISO-8601 UTC timestamp with up to microsecond precision. */
  t: string;
  /** Row id (uuid). */
  i: string;
}

export interface ActivityFilters {
  status?: ToolCallStatus;
  mcp?: string;
  tool?: string;
  apiKeyId?: string;
}

export interface ActivityQuery {
  filters: ActivityFilters;
  limit: number;
  cursor: ActivityCursor | null;
}

export type ParseResult = { ok: true; query: ActivityQuery } | { ok: false; error: string };

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_SET: ReadonlySet<string> = new Set(toolCallStatuses);

function toBase64Url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function fromBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    return Buffer.from(s, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** Opaque, URL-safe cursor for the row AFTER which the next page starts. */
export function encodeCursor(cursor: ActivityCursor): string {
  return toBase64Url(JSON.stringify({ t: cursor.t, i: cursor.i }));
}

/** Decode a cursor; null when it is malformed or was tampered with. */
export function decodeCursor(raw: string | null | undefined): ActivityCursor | null {
  if (!raw || raw.length > 200) return null;
  const json = fromBase64Url(raw);
  if (!json) return null;
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object") return null;
    const { t, i } = v as Record<string, unknown>;
    if (typeof t !== "string" || typeof i !== "string") return null;
    if (!ISO_RE.test(t) || !UUID_RE.test(i) || Number.isNaN(Date.parse(t))) return null;
    return { t, i: i.toLowerCase() };
  } catch {
    return null;
  }
}

/** Clamp a requested page size into 1..ACTIVITY_MAX_LIMIT (default 50). */
export function clampLimit(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return ACTIVITY_DEFAULT_LIMIT;
  return Math.min(ACTIVITY_MAX_LIMIT, Math.max(1, Math.floor(n)));
}

function cleanText(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  return v.slice(0, MAX_FILTER_LENGTH);
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Parse `status`, `mcp`, `tool`, `apiKey`, `limit` and `cursor` query params.
 * Unknown status or a bad cursor is an error (the API answers 400); empty
 * values mean "no filter".
 */
export function parseActivityQuery(params: ParamSource): ParseResult {
  const filters: ActivityFilters = {};

  const status = cleanText(read(params, "status"));
  if (status && status !== "all") {
    if (!STATUS_SET.has(status)) {
      return {
        ok: false,
        error: `Invalid status. Use one of: ${toolCallStatuses.join(", ")}.`,
      };
    }
    filters.status = status as ToolCallStatus;
  }

  const mcp = cleanText(read(params, "mcp"));
  if (mcp && mcp !== "all") filters.mcp = mcp;
  const tool = cleanText(read(params, "tool"));
  if (tool) filters.tool = tool;
  const apiKeyId = cleanText(read(params, "apiKey"));
  if (apiKeyId && apiKeyId !== "all") filters.apiKeyId = apiKeyId;

  const rawCursor = cleanText(read(params, "cursor"));
  let cursor: ActivityCursor | null = null;
  if (rawCursor) {
    cursor = decodeCursor(rawCursor);
    if (!cursor) return { ok: false, error: "Invalid cursor." };
  }

  return { ok: true, query: { filters, limit: clampLimit(read(params, "limit")), cursor } };
}

/** True when any filter narrows the list (for the empty-state wording). */
export function hasActiveFilters(filters: ActivityFilters): boolean {
  return Boolean(filters.status || filters.mcp || filters.tool || filters.apiKeyId);
}

/**
 * Given limit + 1 fetched rows, return the page and the cursor of its last row
 * when more rows exist.
 */
export function paginate<T extends { id: string; cursorTs: string }>(
  rows: T[],
  limit: number
): { page: T[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last ? encodeCursor({ t: last.cursorTs, i: last.id }) : null;
  return { page, nextCursor };
}

// ── Query ────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  createdAt: string;
  mcpSlug: string;
  toolName: string | null;
  status: ToolCallStatus;
  errorCode: number | null;
  latencyMs: number | null;
  requestId: string;
  apiKeyId: string | null;
  /** Display prefix of the API key used (null for a deleted key or an OAuth token). */
  apiKeyPrefix: string | null;
  apiKeyName: string | null;
  /** The connector's (self-declared) name when the call came through OAuth. */
  oauthClientName: string | null;
  externalUserId: string | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
  /** Days of history the owner's plan shows. */
  retentionDays: number;
}

/**
 * One page of a server's tool calls, newest first, within the owner's plan
 * retention (rows past it are hidden even before the purge removes them, e.g.
 * right after a downgrade). The caller MUST have checked server ownership.
 */
export async function listServerToolCalls(opts: {
  userId: string;
  serverId: string;
  plan: string | null | undefined;
  query: ActivityQuery;
  now?: Date;
}): Promise<ActivityPage> {
  const { userId, serverId, plan, query } = opts;
  const { filters, limit, cursor } = query;

  const conds: SQL[] = [
    eq(toolCalls.serverId, serverId),
    eq(toolCalls.userId, userId),
    gte(toolCalls.createdAt, activityCutoff(plan, opts.now)),
  ];
  if (filters.status) conds.push(eq(toolCalls.status, filters.status));
  if (filters.mcp) conds.push(eq(toolCalls.mcpSlug, filters.mcp));
  if (filters.tool) conds.push(eq(toolCalls.toolName, filters.tool));
  if (filters.apiKeyId) conds.push(eq(toolCalls.apiKeyId, filters.apiKeyId));
  if (cursor) {
    // The redundant `<=` lets the (server_id, created_at desc) index range-scan.
    conds.push(lte(toolCalls.createdAt, sql`${cursor.t}::timestamptz`));
    conds.push(
      sql`(${toolCalls.createdAt}, ${toolCalls.id}) < (${cursor.t}::timestamptz, ${cursor.i}::uuid)`
    );
  }

  const rows = await getDb()
    .select({
      id: toolCalls.id,
      cursorTs: sql<string>`to_char(${toolCalls.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      mcpSlug: toolCalls.mcpSlug,
      toolName: toolCalls.toolName,
      status: toolCalls.status,
      errorCode: toolCalls.errorCode,
      latencyMs: toolCalls.latencyMs,
      requestId: toolCalls.requestId,
      apiKeyId: toolCalls.apiKeyId,
      apiKeyPrefix: apiKeys.prefix,
      apiKeyName: apiKeys.name,
      oauthClientName: oauthClients.clientName,
      externalUserId: toolCalls.externalUserId,
    })
    .from(toolCalls)
    // Same-owner joins: a key id from another account never leaks its label.
    .leftJoin(apiKeys, and(eq(apiKeys.id, toolCalls.apiKeyId), eq(apiKeys.userId, userId)))
    // OAuth access-token ids land in api_key_id too (contract D4).
    .leftJoin(
      oauthTokens,
      and(sql`${oauthTokens.id}::text = ${toolCalls.apiKeyId}`, eq(oauthTokens.userId, userId))
    )
    .leftJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(and(...conds))
    .orderBy(desc(toolCalls.createdAt), desc(toolCalls.id))
    .limit(limit + 1);

  const { page, nextCursor } = paginate(rows, limit);
  return {
    items: page.map(({ cursorTs, ...r }) => ({ ...r, createdAt: cursorTs })),
    nextCursor,
    retentionDays: activityRetentionDays(plan),
  };
}
