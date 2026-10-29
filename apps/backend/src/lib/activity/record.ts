import { getDb } from "@/db";
import {
  toolCalls,
  toolCallStatuses,
  type NewToolCall,
  type ToolCallStatus,
} from "@/db/schema/activity";

/**
 * Tool-call activity log writer (contract D1).
 *
 * `recordToolCall` is called from the MCP proxy hot path, so it is
 * fire-and-forget and NEVER throws or awaits: rows are buffered in-process and
 * flushed as one multi-row INSERT (every ACTIVITY_FLUSH_MS, default 1000, or as
 * soon as ACTIVITY_FLUSH_BATCH rows, default 50, are waiting). A DB outage
 * drops rows (logged) rather than slowing or failing a tool call; the buffer is
 * bounded so it can't grow without limit. Per-process buffer — matches the
 * single-container deployment, like the other in-process caches.
 *
 * METADATA ONLY, by design (GDPR): there is deliberately no field for tool
 * arguments or results. Do not add one.
 *
 * Kill switch: ACTIVITY_LOG_DISABLED=1 turns recording off entirely.
 * ACTIVITY_FLUSH_MS=0 inserts each row immediately (still fire-and-forget).
 */

export interface RecordToolCallInput {
  userId: string;
  serverId: string;
  userServerId?: string | null;
  mcpSlug: string;
  toolName: string | null;
  status: ToolCallStatus;
  errorCode?: number | null;
  latencyMs?: number | null;
  requestId: string;
  apiKeyId?: string | null;
  externalUserId?: string | null;
}

/** Longest text kept per column — tool names and slugs are short; this only
 *  guards against a hostile client sending a megabyte "tool name". */
export const MAX_TEXT_LENGTH = 200;
const INT32_MAX = 2_147_483_647;
const INT32_MIN = -2_147_483_648;

const STATUS_SET: ReadonlySet<string> = new Set(toolCallStatuses);

function clip(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.length > MAX_TEXT_LENGTH ? v.slice(0, MAX_TEXT_LENGTH) : v;
}

function int32(value: number | null | undefined, min = INT32_MIN): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < min) return min;
  return n > INT32_MAX ? INT32_MAX : n;
}

/**
 * Validate and normalize a record into an insertable row. Pure. Returns null
 * when a required field is missing (the call is then simply not logged) —
 * an unknown status is coerced to "error" rather than dropped.
 */
export function toToolCallRow(
  input: RecordToolCallInput,
  now: Date = new Date()
): NewToolCall | null {
  if (!input || typeof input !== "object") return null;
  const userId = clip(input.userId);
  const serverId = clip(input.serverId);
  const mcpSlug = clip(input.mcpSlug);
  const requestId = clip(input.requestId);
  if (!userId || !serverId || !mcpSlug || !requestId) return null;

  return {
    userId,
    serverId,
    userServerId: clip(input.userServerId),
    mcpSlug,
    toolName: clip(input.toolName),
    status: STATUS_SET.has(input.status) ? input.status : "error",
    errorCode: int32(input.errorCode),
    latencyMs: int32(input.latencyMs, 0),
    requestId,
    apiKeyId: clip(input.apiKeyId),
    externalUserId: clip(input.externalUserId),
    // The call's own time, not the (up to ACTIVITY_FLUSH_MS later) flush.
    createdAt: now,
  };
}

/** Postgres foreign_key_violation, wherever the driver put the code. */
export function isForeignKeyViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 4; depth++) {
    if ((e as { code?: unknown }).code === "23503") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

// ── Buffered writer ──────────────────────────────────────────────────────────

const MAX_BUFFERED = 5_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

let buffer: NewToolCall[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let droppedSinceLastLog = 0;

/**
 * One multi-row INSERT. A foreign-key violation (a server, MCP or account
 * deleted inside the flush window) must not drop the other users' rows: the
 * batch is then retried row by row, and a row whose installation is gone is
 * kept with user_server_id nulled.
 */
function insertRows(rows: NewToolCall[]): void {
  try {
    void getDb()
      .insert(toolCalls)
      .values(rows)
      .catch((err: unknown) => {
        if (isForeignKeyViolation(err)) {
          if (rows.length > 1) {
            for (const row of rows) insertRows([row]);
            return;
          }
          const [row] = rows;
          if (row?.userServerId) {
            insertRows([{ ...row, userServerId: null }]);
            return;
          }
        }
        console.error(`[activity] failed to record ${rows.length} tool call(s):`, err);
      });
  } catch (err) {
    // getDb() throws synchronously when DATABASE_URL is missing.
    console.error("[activity] recording unavailable:", err);
  }
}

/** Write every buffered row now (one INSERT). Never throws. */
export function flushToolCalls(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;
  const rows = buffer;
  buffer = [];
  if (droppedSinceLastLog > 0) {
    console.warn(`[activity] buffer full: dropped ${droppedSinceLastLog} tool-call record(s)`);
    droppedSinceLastLog = 0;
  }
  insertRows(rows);
}

/**
 * Log one tool call. Fire-and-forget: returns immediately, never throws, never
 * blocks the proxy. Metadata only — see the module comment.
 */
export function recordToolCall(input: RecordToolCallInput): void {
  try {
    if (process.env.ACTIVITY_LOG_DISABLED === "1") return;
    const row = toToolCallRow(input);
    if (!row) return;

    const flushMs = envInt("ACTIVITY_FLUSH_MS", 1_000);
    if (flushMs === 0) {
      insertRows([row]);
      return;
    }

    if (buffer.length >= MAX_BUFFERED) {
      droppedSinceLastLog++;
      return;
    }
    buffer.push(row);

    if (buffer.length >= Math.max(1, envInt("ACTIVITY_FLUSH_BATCH", 50))) {
      flushToolCalls();
      return;
    }
    if (!timer) {
      timer = setTimeout(flushToolCalls, flushMs);
      // Don't keep the process alive just to flush the activity log.
      (timer as { unref?: () => void }).unref?.();
    }
  } catch (err) {
    console.error("[activity] recordToolCall failed:", err);
  }
}
