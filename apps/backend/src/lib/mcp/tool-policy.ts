// Per-installation tool access policy (contract D2).
//
// Stored on `user_servers.tool_policy` (jsonb, null = every tool). The proxy
// applies it in two places:
//
//   tools/list  → the response is rewritten so hidden tools never reach the
//                 client (applyPolicyToJsonRpcResponse, JSON or SSE body);
//   tools/call  → a call to a tool the policy does not allow is refused before
//                 it is forwarded (isToolCallAllowed).
//
// Modes:
//   all         every tool, minus `deny`;
//   read_only   only tools whose server-declared annotations say
//               `readOnlyHint: true`, minus `deny`. Annotations are hints from
//               the MCP author, not a guarantee: a tool that declares nothing is
//               treated as NOT read-only (fail closed);
//   allow_list  only the names in `allow`, minus `deny`. An empty allow-list
//               blocks every tool.
//
// `deny` always wins. Names match exactly (MCP tool names are case-sensitive)
// and are the MCP's own, unprefixed names — the aggregated endpoint strips its
// `<mcpSlug>__` prefix before asking.
//
// Pure and client-safe: no imports, no I/O. Unit-tested in
// src/__tests__/tool-policy.test.ts.

export const TOOL_POLICY_MODES = ["all", "read_only", "allow_list"] as const;
export type ToolPolicyMode = (typeof TOOL_POLICY_MODES)[number];

export interface ToolPolicy {
  mode: ToolPolicyMode;
  allow?: string[];
  deny?: string[];
}

/** MCP tool annotations (spec 2025-03-26+). All are optional hints. */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** The minimum a tools/list entry needs for the policy to judge it. */
export interface PolicyTool {
  name: string;
  annotations?: ToolAnnotations | null;
}

/** A tools/list entry as the dashboard shows it. */
export interface ToolSummary extends PolicyTool {
  title?: string;
  description?: string;
}

/** Caps on a stored policy: a list longer than any real MCP's tool count. */
export const MAX_POLICY_TOOLS = 500;
export const MAX_TOOL_NAME_LENGTH = 256;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isMode(v: unknown): v is ToolPolicyMode {
  return typeof v === "string" && (TOOL_POLICY_MODES as readonly string[]).includes(v);
}

/** Trim, drop non-strings / empties / over-long names, de-duplicate, cap. */
function normalizeNames(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const name = v.trim();
    if (!name || name.length > MAX_TOOL_NAME_LENGTH) continue;
    seen.add(name);
    if (seen.size >= MAX_POLICY_TOOLS) break;
  }
  return [...seen];
}

/**
 * Read a stored (or submitted) policy. Returns null — "every tool" — for
 * null/undefined, non-objects, unparseable strings and unknown modes. The
 * write path (the policy route) validates with zod first, so an unknown mode
 * here can only mean a hand-edited row. `allow` is kept only in allow_list
 * mode; empty `deny` lists are omitted.
 */
export function parseToolPolicy(raw: unknown): ToolPolicy | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(value) || !isMode(value.mode)) return null;

  const policy: ToolPolicy = { mode: value.mode };
  if (value.mode === "allow_list") policy.allow = normalizeNames(value.allow) ?? [];
  const deny = normalizeNames(value.deny);
  if (deny && deny.length > 0) policy.deny = deny;
  return policy;
}

/** True when the policy lets every tool through (null, or "all" with no deny). */
export function isUnrestricted(policy: ToolPolicy | null | undefined): boolean {
  return !policy || (policy.mode === "all" && !(policy.deny && policy.deny.length > 0));
}

/**
 * True when judging a tools/call needs the MCP's tool annotations (read_only
 * mode): the proxy must then know the tools/list result (cached or fetched)
 * and pass it as `knownTools` to isToolCallAllowed.
 */
export function policyNeedsToolAnnotations(policy: ToolPolicy | null | undefined): boolean {
  return !!policy && policy.mode === "read_only";
}

function isDenied(name: string, policy: ToolPolicy): boolean {
  return !!policy.deny && policy.deny.includes(name);
}

function passes(tool: { name?: unknown; annotations?: unknown }, policy: ToolPolicy): boolean {
  const name = typeof tool?.name === "string" ? tool.name : null;
  // A nameless entry cannot be called; only "all" mode lets it through as-is.
  if (name === null) return policy.mode === "all";
  if (isDenied(name, policy)) return false;
  switch (policy.mode) {
    case "all":
      return true;
    case "allow_list":
      return !!policy.allow && policy.allow.includes(name);
    case "read_only": {
      const ann = tool.annotations;
      return isPlainObject(ann) && ann.readOnlyHint === true;
    }
  }
}

/**
 * Filter a tools/list result. Returns the same array when nothing is
 * restricted, otherwise a new array keeping the original order.
 */
export function filterToolsList<T extends PolicyTool>(
  tools: T[],
  policy: ToolPolicy | null | undefined
): T[] {
  if (!policy || isUnrestricted(policy)) return tools;
  return tools.filter((t) => passes(t, policy));
}

/**
 * May this tools/call go through? `knownTools` is the MCP's tools/list result;
 * it is only consulted in read_only mode, where a tool absent from it (or
 * passed without it) is refused — the proxy cannot vouch for an unknown tool.
 */
export function isToolCallAllowed(
  toolName: string,
  policy: ToolPolicy | null | undefined,
  knownTools?: ReadonlyArray<PolicyTool> | null
): boolean {
  if (!policy || isUnrestricted(policy)) return true;
  if (typeof toolName !== "string" || !toolName) return false;
  if (isDenied(toolName, policy)) return false;
  switch (policy.mode) {
    case "all":
      return true;
    case "allow_list":
      return !!policy.allow && policy.allow.includes(toolName);
    case "read_only": {
      const known = knownTools?.find((t) => t?.name === toolName);
      return !!known && passes(known, policy);
    }
  }
}

/** The message a refused tools/call carries (JSON-RPC error.message). */
export function toolDeniedMessage(toolName: string, policy: ToolPolicy | null | undefined): string {
  const name = JSON.stringify(String(toolName ?? "").slice(0, MAX_TOOL_NAME_LENGTH));
  if (policy && isDenied(String(toolName), policy)) {
    return `Tool ${name} is blocked by this MCP's tool access policy (deny list).`;
  }
  if (policy?.mode === "read_only") {
    return `Tool ${name} is blocked by this MCP's tool access policy (read-only mode allows only tools marked readOnlyHint).`;
  }
  if (policy?.mode === "allow_list") {
    return `Tool ${name} is blocked by this MCP's tool access policy (not on the allow-list).`;
  }
  return `Tool ${name} is blocked by this MCP's tool access policy.`;
}

// ─── Response rewriting ─────────────────────────────────────────────────────

/** Rewrite one JSON-RPC message if it is a tools/list result; null if untouched. */
function rewriteMessage(msg: unknown, policy: ToolPolicy): unknown | null {
  if (!isPlainObject(msg) || !isPlainObject(msg.result)) return null;
  const tools = msg.result.tools;
  if (!Array.isArray(tools)) return null;
  const kept = tools.filter((t) => passes(isPlainObject(t) ? t : {}, policy));
  if (kept.length === tools.length) return null;
  return { ...msg, result: { ...msg.result, tools: kept } };
}

/** Rewrite a JSON body (single message or batch); null when unchanged/unparseable. */
function rewriteJsonText(text: string, policy: ToolPolicy): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    let changed = false;
    const out = parsed.map((m) => {
      const r = rewriteMessage(m, policy);
      if (r === null) return m;
      changed = true;
      return r;
    });
    return changed ? JSON.stringify(out) : null;
  }
  const r = rewriteMessage(parsed, policy);
  return r === null ? null : JSON.stringify(r);
}

/**
 * Rewrite every SSE event whose `data:` payload is a tools/list result. Other
 * fields (event:, id:, retry:, comments) and line endings are preserved; a
 * multi-line data payload is replaced by a single `data:` line.
 */
function rewriteSse(text: string, policy: ToolPolicy): string {
  // [line, sep, line, sep, …, line] — the last line may be "" (trailing sep).
  const parts = text.split(/(\r\n|\r|\n)/);
  const lines: string[] = [];
  const seps: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    lines.push(parts[i] ?? "");
    seps.push(parts[i + 1] ?? "");
  }
  const removed = new Set<number>();
  let changed = false;
  let dataIdx: number[] = [];

  const flush = () => {
    if (dataIdx.length === 0) return;
    const payload = dataIdx
      .map((i) => {
        const v = lines[i]!.slice(5);
        return v.startsWith(" ") ? v.slice(1) : v;
      })
      .join("\n");
    const rewritten = rewriteJsonText(payload, policy);
    if (rewritten !== null) {
      changed = true;
      lines[dataIdx[0]!] = `data: ${rewritten}`;
      for (const i of dataIdx.slice(1)) removed.add(i);
    }
    dataIdx = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === "") flush();
    else if (line.startsWith("data:")) dataIdx.push(i);
  }
  flush();

  if (!changed) return text;
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    if (removed.has(i)) continue;
    out += lines[i] + seps[i];
  }
  return out;
}

/**
 * Apply the policy to a complete upstream response body (the proxy buffers a
 * tools/list response before calling this). Handles a JSON body — a single
 * message or a batch — and an SSE (`text/event-stream`) body. Anything that is
 * not a tools/list result, or not parseable, is returned unchanged, as is
 * every body when the policy is unrestricted.
 */
export function applyPolicyToJsonRpcResponse(
  bodyText: string,
  policy: ToolPolicy | null | undefined
): string {
  if (!policy || isUnrestricted(policy) || !bodyText) return bodyText;
  const head = bodyText.trimStart()[0];
  if (head === "{" || head === "[") return rewriteJsonText(bodyText, policy) ?? bodyText;
  if (!bodyText.includes("data:")) return bodyText;
  return rewriteSse(bodyText, policy);
}

// ─── Dashboard helper ───────────────────────────────────────────────────────

function toSummary(raw: unknown, prefix: string | null): ToolSummary | null {
  if (!isPlainObject(raw) || typeof raw.name !== "string" || !raw.name) return null;
  let name = raw.name;
  if (prefix && name.startsWith(prefix) && name.length > prefix.length) {
    name = name.slice(prefix.length);
  }
  const out: ToolSummary = { name };
  if (typeof raw.title === "string") out.title = raw.title;
  if (typeof raw.description === "string") out.description = raw.description;
  if (isPlainObject(raw.annotations)) {
    const a = raw.annotations;
    const ann: ToolAnnotations = {};
    if (typeof a.title === "string") ann.title = a.title;
    for (const k of [
      "readOnlyHint",
      "destructiveHint",
      "idempotentHint",
      "openWorldHint",
    ] as const) {
      if (typeof a[k] === "boolean") ann[k] = a[k];
    }
    out.annotations = ann;
  }
  return out;
}

/** Find a `tools` array in a JSON-RPC message, a JSON/SSE text body, or a wrapper. */
function findTools(raw: unknown, depth: number): unknown[] | null {
  if (depth > 4 || raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    const head = raw.trimStart()[0];
    if (head === "{" || head === "[") {
      try {
        return findTools(JSON.parse(raw), depth + 1);
      } catch {
        return null;
      }
    }
    for (const line of raw.split(/\r\n|\r|\n/)) {
      if (!line.startsWith("data:")) continue;
      const found = findTools(line.slice(5).trim(), depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (Array.isArray(raw)) {
    for (const m of raw) {
      const found = findTools(m, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(raw)) return null;
  if (Array.isArray(raw.tools)) return raw.tools;
  for (const key of ["result", "response", "data", "body"]) {
    const found = findTools(raw[key], depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Pull the tool list out of whatever the playground endpoint
 * (POST /api/v2/servers/[id]/try {method:"tools/list"}) returned: a bare
 * `{tools}`, a JSON-RPC message, a wrapper around one, or a raw JSON/SSE text
 * body. With `mcpSlug`, an aggregated list (names prefixed `<mcpSlug>__`) is
 * narrowed to this MCP and the prefix stripped back to the MCP's own name.
 * Null when no tool list is found.
 */
export function extractToolsFromTryResponse(raw: unknown, mcpSlug?: string): ToolSummary[] | null {
  const tools = findTools(raw, 0);
  if (!tools) return null;
  const prefix = mcpSlug ? `${mcpSlug}__` : null;
  // An aggregated list mixes every MCP on the server: when any name carries
  // this MCP's prefix, keep only those.
  const aggregated =
    !!prefix &&
    tools.some((t) => isPlainObject(t) && typeof t.name === "string" && t.name.startsWith(prefix));
  const seen = new Set<string>();
  const out: ToolSummary[] = [];
  for (const t of tools) {
    if (aggregated && !(isPlainObject(t) && String(t.name).startsWith(prefix!))) continue;
    const s = toSummary(t, prefix);
    if (!s || seen.has(s.name)) continue;
    seen.add(s.name);
    out.push(s);
  }
  return out;
}
