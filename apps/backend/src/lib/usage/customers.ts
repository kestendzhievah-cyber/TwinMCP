// Per-end-customer usage (agencies): tool calls grouped by the end customer
// they were made for. A tool_calls row carries the external_user_id of the
// API key that made it (an mcp_proxy key labelled for one of the agency's
// customers); calls without a label are grouped by the key itself.
//
// Pure: range parsing, row shaping and CSV. The query lives in
// app/api/v2/usage/customers/route.ts. Unit-tested in
// src/__tests__/usage-customers.test.ts.

import { toCsv } from "@/lib/admin/csv";
import { activityRetentionDays, cutoffFor } from "@/lib/activity/retention";

/** Rows returned at most (largest first); the response says when it was cut. */
export const CUSTOMER_ROWS_MAX = 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const SERVER_ID_MAX = 128;
const DAY_MS = 86_400_000;

export interface CustomerUsageRange {
  from: Date;
  to: Date;
  /** Days of tool-call activity the plan keeps (the oldest `from` allowed). */
  retentionDays: number;
  /** True when the requested `from` was older than the retention and moved up. */
  clamped: boolean;
  serverId: string | null;
}

export type RangeResult = ({ ok: true } & CustomerUsageRange) | { ok: false; error: string };

/**
 * A `from` / `to` bound: a date (YYYY-MM-DD, UTC; as `to` it covers that whole
 * day) or an ISO-8601 date-time with a zone. Null when absent, undefined when
 * malformed.
 */
function parseBound(raw: string | null, end: boolean): Date | null | undefined {
  const s = raw?.trim();
  if (!s) return null;
  if (DATE_RE.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return undefined;
    return end ? new Date(d.getTime() + DAY_MS) : d;
  }
  if (DATETIME_RE.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/**
 * `from`, `to` and `serverId` query params → the window to aggregate. `from`
 * defaults to (and is clamped up to) the plan's activity retention, `to` to
 * now; the window is half-open [from, to).
 */
export function parseCustomerUsageRange(
  params: { get(name: string): string | null },
  plan: string | null | undefined,
  now: Date = new Date()
): RangeResult {
  const retentionDays = activityRetentionDays(plan);
  const oldest = cutoffFor(retentionDays, now);

  const from = parseBound(params.get("from"), false);
  const to = parseBound(params.get("to"), true);
  if (from === undefined)
    return { ok: false, error: "from must be YYYY-MM-DD or an ISO date-time." };
  if (to === undefined) return { ok: false, error: "to must be YYYY-MM-DD or an ISO date-time." };

  const end = to && to.getTime() < now.getTime() ? to : now;
  const clamped = !!from && from.getTime() < oldest.getTime();
  const start = !from || clamped ? oldest : from;
  if (start.getTime() >= end.getTime()) {
    return { ok: false, error: "from must be before to (and within your activity retention)." };
  }

  const rawServer = params.get("serverId")?.trim() || null;
  if (rawServer && (rawServer.length > SERVER_ID_MAX || !/^[A-Za-z0-9_-]+$/.test(rawServer))) {
    return { ok: false, error: "serverId is not a valid server id." };
  }

  return { ok: true, from: start, to: end, retentionDays, clamped, serverId: rawServer };
}

/** One group as the SQL returns it. */
export interface RawCustomerGroup {
  externalUserId: string | null;
  /** The key of an unlabelled group; for a labelled group, its only key (if just one). */
  apiKeyId: string | null;
  /** Distinct keys in the group (a customer may have been issued several). */
  keyCount: number;
  calls: number;
  errors: number;
  lastCallAt: Date | string | null;
}

export interface KeyInfo {
  prefix: string;
  name: string | null;
}

export interface CustomerUsageRow {
  /** The agency's id for its end customer, as set on the API key. */
  externalUserId: string | null;
  /** The key's display prefix when the group used exactly one known key. */
  apiKeyPrefix: string | null;
  apiKeyName: string | null;
  /** Logged tool calls (any outcome). */
  calls: number;
  /** Calls that did not succeed: errors, plus denied or rate-limited calls. */
  errors: number;
  /** ISO-8601. */
  lastCallAt: string | null;
}

function iso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Shape the SQL groups for the API: attach the key prefix / name (only when a
 * group maps to one key the account still has) and sort by calls, then by the
 * most recent call.
 */
export function toCustomerRows(
  groups: readonly RawCustomerGroup[],
  keys: ReadonlyMap<string, KeyInfo>
): CustomerUsageRow[] {
  return groups
    .map((g) => {
      const key = g.apiKeyId && g.keyCount <= 1 ? keys.get(g.apiKeyId) : undefined;
      return {
        externalUserId: g.externalUserId,
        apiKeyPrefix: key?.prefix ?? null,
        apiKeyName: key?.name ?? null,
        calls: Number(g.calls) || 0,
        errors: Number(g.errors) || 0,
        lastCallAt: iso(g.lastCallAt),
      };
    })
    .sort(
      (a, b) =>
        b.calls - a.calls ||
        (b.lastCallAt ?? "").localeCompare(a.lastCallAt ?? "") ||
        (a.externalUserId ?? "").localeCompare(b.externalUserId ?? "")
    );
}

/** The key ids whose prefix / name the rows need. */
export function keyIdsToResolve(groups: readonly RawCustomerGroup[]): string[] {
  const ids = new Set<string>();
  for (const g of groups) if (g.apiKeyId && g.keyCount <= 1) ids.add(g.apiKeyId);
  return [...ids];
}

export const CUSTOMER_CSV_HEADER = [
  "external_user_id",
  "api_key_prefix",
  "api_key_name",
  "tool_calls",
  "errors",
  "last_call_at",
];

/** Rows → CSV (UTF-8 BOM, CRLF, quoted and formula-safe cells). */
export function customersToCsv(rows: readonly CustomerUsageRow[]): string {
  return toCsv(
    CUSTOMER_CSV_HEADER,
    rows.map((r) => [
      r.externalUserId ?? "",
      r.apiKeyPrefix ?? "",
      r.apiKeyName ?? "",
      r.calls,
      r.errors,
      r.lastCallAt ?? "",
    ])
  );
}

/** `twinmcp-customers-2026-10-01_2026-10-29.csv` (UTC dates of the window). */
export function customersCsvFilename(from: Date, to: Date): string {
  const last = new Date(Math.max(from.getTime(), to.getTime() - 1));
  return `twinmcp-customers-${from.toISOString().slice(0, 10)}_${last.toISOString().slice(0, 10)}.csv`;
}
