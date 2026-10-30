// One MCP endpoint per server (contract D3): /api/mcp/<serverSlug> aggregates
// every enabled MCP installed on the server behind a single URL.
//
//   initialize    answered by the control plane (serverInfo "TwinMCP").
//   tools/list    fanned out to every MCP in parallel; each tool is renamed
//                 `<mcpSlug>__<toolName>` so names never collide (made
//                 client-safe: [A-Za-z0-9_-], at most 64 characters).
//   tools/call    the prefix picks the MCP; the call is forwarded with the MCP's
//                 own tool name and billed exactly like the per-MCP endpoint.
//
// Everything here is pure (no imports, no I/O) so the route stays thin and the
// rules are unit-tested in src/__tests__/aggregate.test.ts.

/** Separator between the MCP slug and the MCP's own tool name. */
export const TOOL_NAME_SEPARATOR = "__";

/** A tools/list entry, as MCPs return it (extra fields are kept verbatim). */
export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  } | null;
  [key: string]: unknown;
}

/** `fetch` + `fetch_url` → `fetch__fetch_url`. */
export function prefixToolName(mcpSlug: string, toolName: string): string {
  return `${mcpSlug}${TOOL_NAME_SEPARATOR}${toolName}`;
}

/**
 * Split an aggregated tool name back into its MCP slug and the MCP's own tool
 * name. With `knownSlugs` (the MCPs on the server) the longest slug followed by
 * the separator wins, so a slug or a tool name that itself contains `__` still
 * resolves. Without it, the name splits at the first separator. Null when the
 * name carries no usable prefix.
 */
export function splitToolName(
  name: string,
  knownSlugs?: readonly string[]
): { mcpSlug: string; toolName: string } | null {
  if (typeof name !== "string" || !name) return null;
  if (knownSlugs) {
    let best: string | null = null;
    for (const slug of knownSlugs) {
      if (!slug) continue;
      const head = slug + TOOL_NAME_SEPARATOR;
      if (name.length > head.length && name.startsWith(head)) {
        if (!best || slug.length > best.length) best = slug;
      }
    }
    if (!best) return null;
    return { mcpSlug: best, toolName: name.slice(best.length + TOOL_NAME_SEPARATOR.length) };
  }
  const i = name.indexOf(TOOL_NAME_SEPARATOR);
  if (i <= 0) return null;
  const toolName = name.slice(i + TOOL_NAME_SEPARATOR.length);
  if (!toolName) return null;
  return { mcpSlug: name.slice(0, i), toolName };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Keep only well-formed tools/list entries (an object with a non-empty name). */
export function sanitizeTools(raw: unknown): McpTool[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is McpTool => isPlainObject(t) && typeof t.name === "string" && t.name.length > 0
  );
}

// ─── client-safe aggregated names ───────────────────────────────────────────

/**
 * Longest tool name the aggregated endpoint exposes. Claude, OpenAI and Cursor
 * reject a tool list (or the whole model request) when a name goes past 64
 * characters or leaves `^[a-zA-Z0-9_-]{1,64}$`, which `<slug>__<tool>` easily
 * does: slugs go up to 64 characters and MCP tool names may contain `.` or `/`.
 */
export const MAX_EXPOSED_TOOL_NAME = 64;
/** Room kept for `_` + the 6-character hash suffix of an altered name. */
const HASHED_HEAD = MAX_EXPOSED_TOOL_NAME - 7;

/** 6 lower-case base-36 characters derived from `text` (FNV-1a 32-bit). Deterministic. */
export function shortNameHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, "0").slice(-6);
}

/** Is `name` already a client-safe tool name? */
export function isClientSafeToolName(name: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(name);
}

/**
 * The name a tool is exposed under on the aggregated endpoint: `<slug>__<tool>`
 * when that is client-safe; otherwise characters outside `[A-Za-z0-9_-]` become
 * `_`, and a result longer than 64 is cut to 57 characters plus `_` and a hash
 * of the full original name. Deterministic: the same tool always gets the same
 * name, across processes and restarts.
 */
export function exposedToolName(mcpSlug: string, toolName: string): string {
  const raw = prefixToolName(mcpSlug, toolName);
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, "_");
  if (safe.length <= MAX_EXPOSED_TOOL_NAME) return safe;
  return `${safe.slice(0, HASHED_HEAD)}_${shortNameHash(raw)}`;
}

/** Where an exposed (aggregated) tool name points. */
export interface ToolTarget {
  mcpSlug: string;
  toolName: string;
}

/** Exposed name → the MCP and its own tool name. */
export type ToolNameIndex = Map<string, ToolTarget>;

/**
 * Merge per-MCP tool lists into one aggregated list with client-safe names
 * (see exposedToolName), and the reverse index the tools/call routing needs to
 * find the MCP's own name back. Every other field is kept as the MCP sent it.
 * Order follows the input (MCP order, then each MCP's own order). Two tools
 * whose safe names collide (`a.b` and `a_b`): the second gets the hashed form;
 * an exact duplicate keeps its first occurrence.
 */
export function mergeToolListsIndexed(lists: ReadonlyArray<{ mcpSlug: string; tools: unknown }>): {
  tools: McpTool[];
  index: ToolNameIndex;
} {
  const index: ToolNameIndex = new Map();
  const out: McpTool[] = [];
  for (const { mcpSlug, tools } of lists) {
    for (const tool of sanitizeTools(tools)) {
      let name = exposedToolName(mcpSlug, tool.name);
      const prev = index.get(name);
      if (prev) {
        if (prev.mcpSlug === mcpSlug && prev.toolName === tool.name) continue;
        const raw = prefixToolName(mcpSlug, tool.name);
        name = `${name.slice(0, HASHED_HEAD)}_${shortNameHash(raw)}`;
        if (index.has(name)) continue;
      }
      index.set(name, { mcpSlug, toolName: tool.name });
      out.push({ ...tool, name });
    }
  }
  return { tools: out, index };
}

/** mergeToolListsIndexed without the index. */
export function mergeToolLists(
  lists: ReadonlyArray<{ mcpSlug: string; tools: unknown }>
): McpTool[] {
  return mergeToolListsIndexed(lists).tools;
}

// ─── JSON-RPC bodies ─────────────────────────────────────────────────────────

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

/**
 * Parse a POSTed JSON-RPC body: one message object, a batch (array), or
 * unparseable. The aggregated endpoint refuses batches (MCP 2025-06-18 removed
 * them) and answers a parse error itself.
 */
export function parseRpcBody(
  bodyText: string | null | undefined
): { kind: "single"; message: JsonRpcMessage } | { kind: "batch" } | { kind: "invalid" } {
  if (!bodyText || !bodyText.trim()) return { kind: "invalid" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { kind: "invalid" };
  }
  if (Array.isArray(parsed)) return { kind: "batch" };
  if (!isPlainObject(parsed)) return { kind: "invalid" };
  return { kind: "single", message: parsed as JsonRpcMessage };
}

/** The `params.name` of a single tools/call body, else null. */
export function toolCallName(bodyText: string | null | undefined): string | null {
  const parsed = parseRpcBody(bodyText);
  if (parsed.kind !== "single" || parsed.message.method !== "tools/call") return null;
  const name = parsed.message.params?.name;
  return typeof name === "string" && name ? name : null;
}

/**
 * The tools/call body forwarded to one MCP: same id and params (arguments,
 * _meta), with the MCP's own tool name.
 */
export function buildForwardedToolCall(
  id: unknown,
  params: Record<string, unknown> | undefined,
  toolName: string
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: typeof id === "string" || typeof id === "number" ? id : null,
    method: "tools/call",
    params: { ...(params ?? {}), name: toolName },
  });
}

/** The tools/list request the fan-out sends to each MCP (`cursor` for a later page). */
export function toolsListRequest(
  id: string | number = "twinmcp-tools-list",
  cursor?: string | null
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/list",
    params: cursor ? { cursor } : {},
  });
}

/** Most pages of one MCP's tools/list the proxy reads before it stops. */
export const MAX_TOOLS_LIST_PAGES = 10;

/** Is this parsed value a JSON-RPC response (result or error)? */
function isResponse(v: unknown): v is JsonRpcMessage {
  return isPlainObject(v) && ("result" in v || "error" in v);
}

/**
 * Read the JSON-RPC response out of an upstream body, whether it came back as
 * `application/json` or as an SSE stream (`data:` frames; progress
 * notifications are skipped). With `id`, the response carrying that id wins;
 * otherwise the last response in the stream. Null when none is found.
 */
export function extractJsonRpcResponse(
  bodyText: string,
  contentType?: string | null,
  id?: unknown
): JsonRpcMessage | null {
  const text = bodyText ?? "";
  const trimmed = text.trimStart();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  const candidates: unknown[] = [];
  if (looksJson && !(contentType ?? "").includes("text/event-stream")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else candidates.push(parsed);
    } catch {
      return null;
    }
  } else {
    // SSE: events are separated by a blank line; a payload may span several
    // `data:` lines, joined with "\n".
    for (const event of text.split(/\r?\n\r?\n|\r\r/)) {
      const data = event
        .split(/\r\n|\r|\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => {
          const v = l.slice(5);
          return v.startsWith(" ") ? v.slice(1) : v;
        });
      if (data.length === 0) continue;
      try {
        const parsed = JSON.parse(data.join("\n"));
        if (Array.isArray(parsed)) candidates.push(...parsed);
        else candidates.push(parsed);
      } catch {
        /* not JSON: skip the event */
      }
    }
  }
  const responses = candidates.filter(isResponse);
  if (responses.length === 0) return null;
  if (id !== undefined && id !== null) {
    const match = responses.find((r) => r.id === id);
    if (match) return match;
  }
  return responses[responses.length - 1]!;
}

/** The tools array of a tools/list JSON-RPC response, or null. */
export function toolsFromResponse(message: JsonRpcMessage | null): McpTool[] | null {
  if (!message || !isPlainObject(message.result)) return null;
  const tools = (message.result as { tools?: unknown }).tools;
  return Array.isArray(tools) ? sanitizeTools(tools) : null;
}

/** The `nextCursor` of a tools/list response (a non-empty string), else null. */
export function nextCursorOf(message: JsonRpcMessage | null): string | null {
  if (!message || !isPlainObject(message.result)) return null;
  const c = (message.result as { nextCursor?: unknown }).nextCursor;
  return typeof c === "string" && c.length > 0 ? c : null;
}

/**
 * Concatenate the pages of one MCP's tools/list into one list. A tool name
 * seen on an earlier page keeps its first definition.
 */
export function mergePagedToolLists(pages: ReadonlyArray<readonly McpTool[]>): McpTool[] {
  const seen = new Set<string>();
  const out: McpTool[] = [];
  for (const page of pages) {
    for (const tool of page) {
      if (seen.has(tool.name)) continue;
      seen.add(tool.name);
      out.push(tool);
    }
  }
  return out;
}

/**
 * One tools/list response out of the pages read by following `nextCursor`:
 * the first page's envelope (id, other result fields) with every page's tools
 * (mergePagedToolLists) and no `nextCursor`. Null when there is no page.
 */
export function mergeToolsListPages<T extends { result?: unknown }>(pages: readonly T[]): T | null {
  const first = pages[0];
  if (!first) return null;
  const firstResult = isPlainObject(first.result) ? first.result : {};
  const { nextCursor: _cursor, ...rest } = firstResult;
  void _cursor;
  const tools = mergePagedToolLists(
    pages.map((p) => sanitizeTools(isPlainObject(p.result) ? p.result.tools : null))
  );
  return { ...first, result: { ...rest, tools } };
}

// ─── initialize ──────────────────────────────────────────────────────────────

/** Protocol revisions the aggregated endpoint answers in, oldest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
  "2025-11-25",
] as const;

/** Echo the client's revision when we know it, else offer our latest. */
export function negotiateProtocolVersion(requested: unknown): string {
  if (
    typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
  ) {
    return requested;
  }
  return SUPPORTED_PROTOCOL_VERSIONS[SUPPORTED_PROTOCOL_VERSIONS.length - 1];
}

/** The `initialize` result the control plane answers on behalf of the server. */
export function aggregateInitializeResult(
  requestedVersion: unknown,
  opts: { router?: boolean } = {}
): {
  protocolVersion: string;
  capabilities: { tools: { listChanged: boolean } };
  serverInfo: { name: string; version: string };
  instructions: string;
} {
  return {
    protocolVersion: negotiateProtocolVersion(requestedVersion),
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "TwinMCP", version: "1.0.0" },
    instructions: opts.router
      ? "This TwinMCP server exposes its tools through three meta-tools. Call search_tools to find a tool, get_tool_schema to read its arguments, then call_tool to run it. Tool names look like <mcp>__<tool>."
      : "This TwinMCP server aggregates several MCP servers. Each tool is named <mcp>__<tool>, where <mcp> is the MCP it runs on.",
  };
}

// ─── tools/list fan-out ──────────────────────────────────────────────────────

/** How one MCP answered the fan-out. */
export type FanoutState =
  /** Listed its tools just now. */
  | "ok"
  /** Asleep, waking or still installing; `tools` holds the last list we saw, if any. */
  | "waking"
  /** Cannot answer (server stopped, agent offline, error); never retried here. */
  | "unavailable";

export interface FanoutEntry {
  mcpSlug: string;
  state: FanoutState;
  /** The MCP's own (unprefixed) tools, policy already applied. */
  tools: McpTool[];
  /** Shown in the `_meta` warning for a non-ok entry. */
  reason?: string;
}

/** `_meta` key carrying per-MCP warnings on an aggregated tools/list. */
export const WARNINGS_META_KEY = "twinmcp.fr/warnings";

export interface ToolsListResult {
  tools: McpTool[];
  _meta?: Record<string, unknown>;
}

/**
 * Build the aggregated tools/list result from the fan-out: every tool,
 * prefixed, plus a `_meta` warning for each MCP that did not answer live (its
 * last known tools are still listed when we have them).
 */
export function buildToolsListResult(entries: readonly FanoutEntry[]): ToolsListResult {
  return buildIndexedToolsList(entries).result;
}

/** buildToolsListResult plus the exposed-name index (kept server-side, never sent). */
export function buildIndexedToolsList(entries: readonly FanoutEntry[]): {
  result: ToolsListResult;
  index: ToolNameIndex;
} {
  const { tools, index } = mergeToolListsIndexed(
    entries.map((e) => ({ mcpSlug: e.mcpSlug, tools: e.tools }))
  );
  const warnings = entries
    .filter((e) => e.state !== "ok")
    .map((e) => ({
      mcp: e.mcpSlug,
      state: e.state,
      message:
        e.reason ??
        (e.state === "waking"
          ? "This MCP is waking up; its tools will be listed on the next tools/list."
          : "This MCP is unavailable right now."),
    }));
  const result: ToolsListResult =
    warnings.length > 0 ? { tools, _meta: { [WARNINGS_META_KEY]: warnings } } : { tools };
  return { result, index };
}

/**
 * Nothing to list and at least one MCP is merely waking: answer a retryable
 * 503 instead of an empty list, so a client (or the dashboard connection test)
 * retries in a few seconds rather than caching "no tools".
 */
export function shouldAnswerWaking(entries: readonly FanoutEntry[]): boolean {
  const anyTool = entries.some((e) => e.tools.length > 0);
  return !anyTool && entries.some((e) => e.state === "waking");
}

// ─── activity status ─────────────────────────────────────────────────────────

export type ToolCallStatus = "ok" | "error" | "denied" | "rate_limited";

/**
 * The activity-log status (contract D1) of a tools/call from the response the
 * proxy sent: `denied` when the tool policy refused it or when the wallet was
 * empty (402, code CREDIT_EXHAUSTED_CODE), `rate_limited` on a 429, `ok`
 * below 400, else `error`. `errorCode` is the HTTP status of a failed
 * response, or the JSON-RPC code of a refusal made before forwarding.
 * An MCP's own JSON-RPC error inside a 200 counts as ok: the proxy streams
 * tool results without reading them.
 */
export function toolCallStatusFor(
  httpStatus: number,
  deniedCode?: number | null
): { status: ToolCallStatus; errorCode: number | null } {
  if (typeof deniedCode === "number") return { status: "denied", errorCode: deniedCode };
  if (httpStatus === 402) return { status: "denied", errorCode: CREDIT_EXHAUSTED_CODE };
  if (httpStatus === 429) return { status: "rate_limited", errorCode: 429 };
  if (httpStatus < 400) return { status: "ok", errorCode: null };
  return { status: "error", errorCode: httpStatus };
}

/**
 * JSON-RPC code of a tools/call refused by the tool policy (contract D3). Its
 * own code in the server range: -32004 is the proxy's 401 (PROXY_ERROR in
 * lib/errors.ts, which mirrors this value as TOOL_POLICY_DENIED).
 */
export const TOOL_POLICY_DENIED_CODE = -32007;

/**
 * JSON-RPC code of a tools/call refused because the prepaid wallet is empty
 * (contract W2, HTTP 402). Mirrored by PROXY_ERROR.CREDIT_EXHAUSTED.
 */
export const CREDIT_EXHAUSTED_CODE = -32008;

// ─── per-process tool cache ──────────────────────────────────────────────────

/**
 * A small TTL map of each MCP installation's last tools/list (raw, before the
 * policy, so a policy edit applies at once). Used for the router mode's 60 s
 * cache, for the read_only policy check, and to keep listing a waking MCP's
 * tools. Bounded: the oldest entry is evicted past `maxEntries`.
 */
export class ToolCache {
  private readonly entries = new Map<string, { at: number; tools: McpTool[] }>();

  constructor(private readonly maxEntries = 5_000) {}

  set(key: string, tools: McpTool[], now: number = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { at: now, tools });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** The cached tools when younger than `maxAgeMs`, else null. */
  get(key: string, maxAgeMs: number, now: number = Date.now()): McpTool[] | null {
    const hit = this.entries.get(key);
    if (!hit) return null;
    if (now - hit.at > maxAgeMs) return null;
    return hit.tools;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }
}
