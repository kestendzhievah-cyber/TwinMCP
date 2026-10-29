// Router mode of the aggregated server endpoint (contract D3):
// /api/mcp/<serverSlug>?mode=router lists three meta-tools instead of every
// tool of every MCP, so a server with hundreds of tools does not flood the
// model's context:
//
//   search_tools     {query, limit?}  → matching tools (name + description)
//   get_tool_schema  {name}           → one tool's description and inputSchema
//   call_tool        {name, arguments?} → runs the tool (billed like tools/call)
//
// search_tools and get_tool_schema never reach an MCP, so they are free.
// Search is a plain, deterministic token match over name and description —
// no embeddings, no I/O.
//
// Pure: no imports beyond the aggregate naming helpers. Unit-tested in
// src/__tests__/router-tools.test.ts.

import { splitToolName, type McpTool, type ToolTarget } from "./aggregate";

export const ROUTER_SEARCH_TOOL = "search_tools";
export const ROUTER_SCHEMA_TOOL = "get_tool_schema";
export const ROUTER_CALL_TOOL = "call_tool";

export const ROUTER_TOOL_NAMES = [
  ROUTER_SEARCH_TOOL,
  ROUTER_SCHEMA_TOOL,
  ROUTER_CALL_TOOL,
] as const;
export type RouterToolName = (typeof ROUTER_TOOL_NAMES)[number];

export function isRouterToolName(name: unknown): name is RouterToolName {
  return typeof name === "string" && (ROUTER_TOOL_NAMES as readonly string[]).includes(name);
}

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;

/** The tools/list of router mode. */
export const ROUTER_TOOLS: McpTool[] = [
  {
    name: ROUTER_SEARCH_TOOL,
    description:
      "Search the tools available on this TwinMCP server by keywords. Returns tool names (<mcp>__<tool>) and descriptions. Use it before get_tool_schema and call_tool.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords describing what you want to do" },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_SEARCH_LIMIT,
          description: `Maximum number of tools to return (default ${DEFAULT_SEARCH_LIMIT})`,
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: ROUTER_SCHEMA_TOOL,
    description:
      "Get the full description and JSON input schema of one tool found with search_tools.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The tool name, as returned by search_tools" },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: ROUTER_CALL_TOOL,
    description:
      "Run one tool of this TwinMCP server with its arguments. Read its schema with get_tool_schema first.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The tool name, as returned by search_tools" },
        arguments: {
          type: "object",
          description: "The tool's arguments, matching its input schema",
          additionalProperties: true,
        },
      },
      required: ["name"],
    },
  },
];

// Words that carry no meaning in a tool search ("a tool to read the file").
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "by",
  "or",
  "is",
  "it",
  "my",
  "me",
  "this",
  "that",
  "from",
  "tool",
  "tools",
]);

/**
 * Lower-case word tokens of a text: camelCase, snake_case, kebab-case and
 * `mcp__tool` are split, stop words and one-letter tokens dropped, duplicates
 * removed (first occurrence order kept).
 */
export function tokenize(text: unknown): string[] {
  if (typeof text !== "string" || !text) return [];
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of spaced.split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOP_WORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

// Weights: a hit in the tool's name says far more than one in its description.
const NAME_EXACT = 3;
const NAME_PREFIX = 2;
const DESC_EXACT = 1;
const DESC_PREFIX = 0.5;
const WHOLE_NAME_BONUS = 5;

function tokenScore(q: string, tokens: readonly string[], exact: number, prefix: number): number {
  if (tokens.includes(q)) return exact;
  if (q.length >= 3 && tokens.some((t) => t.startsWith(q) || q.startsWith(t))) return prefix;
  return 0;
}

/**
 * Relevance of one tool to the query tokens: per query token, the best of a
 * name hit (exact 3, prefix 2) or a description hit (exact 1, prefix 0.5);
 * +5 when the query is the tool's exact (aggregated or own) name. 0 = no match.
 */
export function scoreTool(
  tool: Pick<McpTool, "name" | "description" | "title">,
  query: string
): number {
  const queryTokens = tokenize(query);
  const q = query.trim().toLowerCase();
  const name = tool.name.toLowerCase();
  let score = 0;
  if (q && (name === q || name.endsWith(`__${q}`))) score += WHOLE_NAME_BONUS;
  if (queryTokens.length === 0) return score;
  const nameTokens = tokenize(`${tool.name} ${tool.title ?? ""}`);
  const descTokens = tokenize(tool.description ?? "");
  for (const qt of queryTokens) {
    score += Math.max(
      tokenScore(qt, nameTokens, NAME_EXACT, NAME_PREFIX),
      tokenScore(qt, descTokens, DESC_EXACT, DESC_PREFIX)
    );
  }
  return score;
}

/** search_tools' `limit`: an integer in [1, 50], default 10. */
export function clampSearchLimit(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(n)));
}

export interface ToolSearchHit {
  name: string;
  description: string;
  score: number;
}

/**
 * Rank `tools` against `query`: matching tools only, best score first, ties by
 * name. An empty query lists the first `limit` tools by name (score 0), so a
 * model can browse a small server.
 */
export function searchTools(
  tools: readonly McpTool[],
  query: unknown,
  limit: unknown = DEFAULT_SEARCH_LIMIT
): ToolSearchHit[] {
  const max = clampSearchLimit(limit);
  const q = typeof query === "string" ? query : "";
  const hits: ToolSearchHit[] = tools.map((t) => ({
    name: t.name,
    description: typeof t.description === "string" ? t.description : "",
    score: q.trim() ? scoreTool(t, q) : 0,
  }));
  const kept = q.trim() ? hits.filter((h) => h.score > 0) : hits;
  kept.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return kept.slice(0, max);
}

/**
 * The text get_tool_schema returns for a tool (JSON, pretty-printed): the tool
 * as the MCP declared it (outputSchema, annotations, _meta… verbatim), under
 * its aggregated name, with a description and an inputSchema always present.
 */
export function describeToolSchema(tool: McpTool): string {
  const { name, title, description, inputSchema, ...rest } = tool;
  return JSON.stringify(
    {
      name,
      ...(title ? { title } : {}),
      description: description ?? "",
      inputSchema: inputSchema ?? { type: "object" },
      ...rest,
    },
    null,
    2
  );
}

/** How many tool names a search with no hit suggests instead. */
export const NO_HIT_SUGGESTIONS = 20;

/**
 * The search_tools answer: the hits, or, when nothing matched, a hint and the
 * first tool names (so the model can retry with better keywords).
 */
export function searchToolsAnswer(
  tools: readonly McpTool[],
  query: unknown,
  limit: unknown,
  warnings?: unknown
): Record<string, unknown> {
  const hits = searchTools(tools, query, limit).map((h) => ({
    name: h.name,
    description: h.description,
  }));
  const extra = warnings ? { warnings } : {};
  if (hits.length > 0 || tools.length === 0) {
    return {
      tools: hits,
      ...(tools.length === 0 ? { hint: "No tool is available on this server right now." } : {}),
      ...extra,
    };
  }
  const names = tools
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, NO_HIT_SUGGESTIONS);
  return {
    tools: [],
    hint: `No tool matched ${JSON.stringify(
      typeof query === "string" ? query : ""
    )}. Try other keywords, or an empty query to list tools. Some of the ${tools.length} available tools:`,
    availableTools: names,
    ...extra,
  };
}

/** `?mode=router` (case-insensitive) selects router mode. */
export function isRouterMode(searchParams: { get(name: string): string | null }): boolean {
  return (searchParams.get("mode") ?? "").trim().toLowerCase() === "router";
}

// ─── tools/call routing on the aggregated endpoint ───────────────────────────

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Where one tools/call on the aggregated endpoint goes. */
export type ToolCallRoute =
  /** Router search_tools: answered by the control plane, free. */
  | { kind: "search"; query: unknown; limit: unknown }
  /** Router get_tool_schema: answered by the control plane, free. */
  | { kind: "schema"; name: string }
  /**
   * A tool of one MCP (directly, or unwrapped from router call_tool): forward
   * `params` with the MCP's own `toolName` (billed as one tools/call).
   */
  | { kind: "forward"; mcpSlug: string; toolName: string; params: Record<string, unknown> }
  /** Answer a JSON-RPC invalid-params error with this message. */
  | { kind: "invalid"; message: string };

/**
 * Route one aggregated tools/call. In router mode the three meta-tools are
 * recognised first (call_tool unwraps into `{name, arguments}` and keeps the
 * caller's `_meta`, e.g. a progress token); any other name, in either mode,
 * must be `<mcpSlug>__<tool>` for one of `mcpSlugs` (the server's enabled MCPs),
 * or a name of `index` (the exposed names of the last merged tools/list).
 */
export function resolveToolCall(
  rawParams: unknown,
  mcpSlugs: readonly string[],
  router: boolean,
  index?: ReadonlyMap<string, ToolTarget> | null
): ToolCallRoute {
  const params = asRecord(rawParams);
  let name: unknown = params.name;
  let forwardParams: Record<string, unknown> = params;

  if (router && isRouterToolName(name)) {
    const args = asRecord(params.arguments);
    if (name === ROUTER_SEARCH_TOOL)
      return { kind: "search", query: args.query, limit: args.limit };
    if (name === ROUTER_SCHEMA_TOOL) {
      return { kind: "schema", name: typeof args.name === "string" ? args.name : "" };
    }
    name = args.name;
    forwardParams = {
      ...(params._meta !== undefined ? { _meta: params._meta } : {}),
      arguments: asRecord(args.arguments),
    };
  }

  if (typeof name !== "string" || !name) {
    return {
      kind: "invalid",
      message: router
        ? "Missing tool name (call_tool needs arguments.name)."
        : "Missing tool name (params.name).",
    };
  }
  // The exposed-name index first (names made client-safe or hashed by
  // mergeToolListsIndexed), then the plain `<slug>__<tool>` split.
  const indexed = index?.get(name);
  const split =
    indexed && mcpSlugs.includes(indexed.mcpSlug) ? indexed : splitToolName(name, mcpSlugs);
  if (!split) {
    return {
      kind: "invalid",
      message: `Unknown tool: ${name}. Tools on this endpoint are named <mcp>__<tool>; ${
        router ? "use search_tools" : "call tools/list"
      } for the current names.`,
    };
  }
  const { name: _drop, ...rest } = forwardParams;
  void _drop;
  return { kind: "forward", mcpSlug: split.mcpSlug, toolName: split.toolName, params: rest };
}
