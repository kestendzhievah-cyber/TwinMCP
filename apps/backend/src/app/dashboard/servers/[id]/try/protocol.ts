// Wire contract and pure helpers of the tool playground.
//
// The browser never holds an API key: it POSTs to /api/v2/servers/[id]/try
// (session-authenticated), which relays to the user's MCP through the same
// gates as the public proxy — quota, metering, tool policy, activity log.
// This module is shared by that route and the client UI.
//
// Pure and client-safe: no I/O. Unit-tested in
// src/__tests__/playground-protocol.test.ts.

export const TRY_METHODS = ["tools/list", "tools/call"] as const;
export type TryMethod = (typeof TRY_METHODS)[number];

/** Arguments above this size are refused (a playground is for hand-made calls). */
export const MAX_ARGUMENTS_BYTES = 256 * 1024;

/** The UI keeps retrying a 503 (waking box, installing MCP) for this long. */
export const WAKE_RETRY_WINDOW_MS = 120_000;

export interface TryRequestBody {
  mcpSlug: string;
  method: TryMethod;
  /** tools/call: the tool to run. */
  name?: string;
  /** tools/call: its arguments (a JSON object). */
  arguments?: Record<string, unknown>;
  /**
   * tools/list only: return the MCP's full list, before the installation's
   * tool policy (the Tool access dialog needs the hidden tools to offer them).
   * The route is owner-only (a management session).
   */
  ignorePolicy?: boolean;
}

/**
 * How a playground request ended:
 * - ok          the MCP answered with a result (for tools/call: not isError)
 * - tool_error  the tool ran and reported a failure (result.isError)
 * - error       a JSON-RPC error, an upstream failure, a refused request
 * - waking      the box is waking / the MCP is installing; retry shortly (503)
 * - denied      the tool policy of this installation blocks the tool (403)
 * - rate_limited too many tool calls this minute (429)
 * - no_credit   the TwinMCP credit is used up (402, JSON-RPC -32008)
 */
export type TryStatus =
  | "ok"
  | "tool_error"
  | "error"
  | "waking"
  | "denied"
  | "rate_limited"
  | "no_credit";

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface TryResponse {
  ok: boolean;
  status: TryStatus;
  result?: unknown;
  error?: JsonRpcError;
  /** Time spent by the control plane on this request, handshake included. */
  latencyMs: number;
  /** x-twinmcp-request-id: quote it to support. */
  requestId: string;
  /** The JSON-RPC message the MCP sent back (or the proxy-made error), as is. */
  raw: unknown;
  /** status "waking": seconds to wait before retrying. */
  retryAfterSec?: number;
  /** tools/list: tools hidden by the installation's tool policy. */
  hiddenByPolicy?: number;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Validate the POST body of /api/v2/servers/[id]/try. */
export function parseTryBody(
  raw: unknown
): { ok: true; body: TryRequestBody } | { ok: false; message: string } {
  if (!isObject(raw)) return { ok: false, message: "Body must be a JSON object." };
  const { mcpSlug, method, name } = raw;
  if (typeof mcpSlug !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(mcpSlug)) {
    return { ok: false, message: "mcpSlug is required." };
  }
  if (typeof method !== "string" || !(TRY_METHODS as readonly string[]).includes(method)) {
    return { ok: false, message: `method must be one of ${TRY_METHODS.join(", ")}.` };
  }
  if (method === "tools/list") {
    return {
      ok: true,
      body: {
        mcpSlug,
        method: "tools/list",
        ...(raw.ignorePolicy === true ? { ignorePolicy: true } : {}),
      },
    };
  }

  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return { ok: false, message: "name (the tool to run) is required." };
  }
  const args = raw.arguments ?? {};
  if (!isObject(args)) return { ok: false, message: "arguments must be a JSON object." };
  if (new TextEncoder().encode(JSON.stringify(args)).length > MAX_ARGUMENTS_BYTES) {
    return { ok: false, message: `arguments exceed ${MAX_ARGUMENTS_BYTES / 1024} KB.` };
  }
  return { ok: true, body: { mcpSlug, method: "tools/call", name, arguments: args } };
}

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  result?: unknown;
  error?: JsonRpcError;
}

function isResponse(v: unknown): v is JsonRpcMessage {
  return isObject(v) && ("result" in v || "error" in v);
}

/** Pick the response to `id` out of one parsed JSON value (object or batch). */
function pick(value: unknown, id: string | number | null): JsonRpcMessage | null {
  const candidates = Array.isArray(value) ? value : [value];
  const responses = candidates.filter(isResponse);
  return responses.find((m) => m.id === id) ?? null;
}

/** The JSON payloads of an SSE body: each event's `data:` lines joined. */
export function sseDataFrames(text: string): string[] {
  const frames: string[] = [];
  for (const event of text.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (data.length > 0) frames.push(data.join("\n"));
  }
  return frames;
}

/**
 * Find the JSON-RPC response to `id` in an MCP Streamable HTTP answer, which
 * is either plain JSON or an SSE stream (`text/event-stream`) whose frames may
 * also carry notifications (progress, logging) before the response. Falls
 * back to the last response in the body when none carries `id`. Null when
 * the body holds no JSON-RPC response at all.
 */
export function parseJsonRpcPayload(
  text: string,
  contentType: string | null,
  id: string | number | null
): JsonRpcMessage | null {
  const isSse =
    (contentType ?? "").includes("text/event-stream") || /^\s*(event|data|id):/m.test(text);
  const values: unknown[] = [];
  const chunks = isSse ? sseDataFrames(text) : [text];
  for (const chunk of chunks) {
    try {
      values.push(JSON.parse(chunk));
    } catch {
      // Not JSON (a keep-alive comment, a truncated frame): skip.
    }
  }
  for (const v of values) {
    const hit = pick(v, id);
    if (hit) return hit;
  }
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    const any = (Array.isArray(v) ? v : [v]).filter(isResponse);
    if (any.length > 0) return any[any.length - 1];
  }
  return null;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface PlaygroundTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: ToolAnnotations;
}

/** Normalize a tools/list result into tools with a name (others are dropped). */
export function extractTools(result: unknown): PlaygroundTool[] {
  if (!isObject(result) || !Array.isArray(result.tools)) return [];
  const out: PlaygroundTool[] = [];
  for (const t of result.tools) {
    if (!isObject(t) || typeof t.name !== "string" || t.name === "") continue;
    const tool: PlaygroundTool = { name: t.name };
    if (typeof t.title === "string") tool.title = t.title;
    if (typeof t.description === "string") tool.description = t.description;
    if ("inputSchema" in t) tool.inputSchema = t.inputSchema;
    if (isObject(t.annotations)) {
      const a = t.annotations;
      const ann: ToolAnnotations = {};
      if (typeof a.title === "string") ann.title = a.title;
      for (const k of [
        "readOnlyHint",
        "destructiveHint",
        "idempotentHint",
        "openWorldHint",
      ] as const) {
        if (typeof a[k] === "boolean") ann[k] = a[k] as boolean;
      }
      tool.annotations = ann;
    }
    out.push(tool);
  }
  return out;
}

/**
 * Annotation badges. Only explicit hints count: MCP defaults destructiveHint
 * to true for non-read-only tools, but an un-annotated tool is shown as
 * "unknown", not as destructive.
 */
export function toolBadges(tool: PlaygroundTool): { readOnly: boolean; destructive: boolean } {
  const readOnly = tool.annotations?.readOnlyHint === true;
  return { readOnly, destructive: !readOnly && tool.annotations?.destructiveHint === true };
}

/** A tool that declares itself destructive needs an explicit confirmation to run. */
export function needsConfirmation(tool: PlaygroundTool): boolean {
  return toolBadges(tool).destructive;
}

/** The tool ran but reported a failure (MCP `CallToolResult.isError`). */
export function isToolResultError(result: unknown): boolean {
  return isObject(result) && result.isError === true;
}

/** The text blocks of a CallToolResult (`content[].type === "text"`). */
export function resultTexts(result: unknown): string[] {
  if (!isObject(result) || !Array.isArray(result.content)) return [];
  return result.content
    .filter(
      (c): c is { type: "text"; text: string } =>
        isObject(c) && c.type === "text" && typeof c.text === "string"
    )
    .map((c) => c.text);
}

/**
 * Delay before the next automatic retry of a 503, or null once the retry
 * window is spent. Honours the server's Retry-After within 2–15 s.
 */
export function nextRetryDelayMs(
  retryAfterSec: number | undefined,
  elapsedMs: number,
  windowMs: number = WAKE_RETRY_WINDOW_MS
): number | null {
  const wanted = Math.min(15, Math.max(2, retryAfterSec ?? 5)) * 1000;
  if (elapsedMs + wanted > windowMs) return null;
  return wanted;
}

/** Filter tools by a search query over name, title and description. */
export function searchTools(tools: PlaygroundTool[], query: string): PlaygroundTool[] {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter((t) =>
    [t.name, t.title, t.annotations?.title, t.description].some((s) => s?.toLowerCase().includes(q))
  );
}
