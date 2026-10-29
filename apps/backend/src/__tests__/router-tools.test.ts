import { describe, it, expect } from "vitest";
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  ROUTER_CALL_TOOL,
  ROUTER_SCHEMA_TOOL,
  ROUTER_SEARCH_TOOL,
  ROUTER_TOOLS,
  clampSearchLimit,
  describeToolSchema,
  isRouterMode,
  isRouterToolName,
  resolveToolCall,
  scoreTool,
  searchTools,
  tokenize,
} from "@/lib/mcp/router-tools";
import type { McpTool } from "@/lib/mcp/aggregate";

const TOOLS: McpTool[] = [
  { name: "github__create_issue", description: "Create a new issue in a GitHub repository" },
  { name: "github__list_pull_requests", description: "List pull requests of a repository" },
  { name: "fetch__fetch", description: "Fetch a URL and return its content as markdown" },
  { name: "filesystem__read_file", description: "Read the complete contents of a file" },
  { name: "filesystem__write_file", description: "Create or overwrite a file" },
  { name: "time__get_current_time", description: "Current time in a timezone" },
];

describe("router meta-tools", () => {
  it("exposes exactly search_tools, get_tool_schema and call_tool", () => {
    expect(ROUTER_TOOLS.map((t) => t.name)).toEqual([
      ROUTER_SEARCH_TOOL,
      ROUTER_SCHEMA_TOOL,
      ROUTER_CALL_TOOL,
    ]);
    expect(ROUTER_TOOLS.map((t) => t.name)).toEqual([
      "search_tools",
      "get_tool_schema",
      "call_tool",
    ]);
  });

  it("marks only the free lookups read-only", () => {
    const byName = Object.fromEntries(ROUTER_TOOLS.map((t) => [t.name, t]));
    expect(byName.search_tools!.annotations?.readOnlyHint).toBe(true);
    expect(byName.get_tool_schema!.annotations?.readOnlyHint).toBe(true);
    expect(byName.call_tool!.annotations?.readOnlyHint).toBeUndefined();
  });

  it("each meta-tool declares an object input schema with its required field", () => {
    const required = ROUTER_TOOLS.map(
      (t) => (t.inputSchema as { type: string; required: string[] }).required
    );
    expect(required).toEqual([["query"], ["name"], ["name"]]);
  });

  it("recognises meta-tool names", () => {
    expect(isRouterToolName("search_tools")).toBe(true);
    expect(isRouterToolName("call_tool")).toBe(true);
    expect(isRouterToolName("fetch__fetch")).toBe(false);
    expect(isRouterToolName(undefined)).toBe(false);
  });
});

describe("tokenize", () => {
  it("splits camelCase, snake_case, kebab-case and mcp__tool", () => {
    expect(tokenize("getCurrentTime")).toEqual(["get", "current", "time"]);
    expect(tokenize("github__create_issue")).toEqual(["github", "create", "issue"]);
    expect(tokenize("read-file")).toEqual(["read", "file"]);
    expect(tokenize("HTTPRequest")).toEqual(["http", "request"]);
  });

  it("drops stop words, one-letter tokens and duplicates", () => {
    expect(tokenize("a tool to read the file, read it")).toEqual(["read", "file"]);
  });

  it("is safe on non-strings", () => {
    expect(tokenize(undefined)).toEqual([]);
    expect(tokenize(42)).toEqual([]);
  });
});

describe("scoreTool", () => {
  it("weighs a name hit above a description hit", () => {
    const nameHit = scoreTool({ name: "x__issue", description: "" }, "issue");
    const descHit = scoreTool({ name: "x__thing", description: "manage an issue" }, "issue");
    expect(nameHit).toBeGreaterThan(descHit);
    expect(descHit).toBeGreaterThan(0);
  });

  it("counts prefix matches below exact ones", () => {
    const exact = scoreTool({ name: "fs__read" }, "read");
    const prefix = scoreTool({ name: "fs__reader" }, "read");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(0);
  });

  it("gives a bonus for the exact aggregated or own name", () => {
    expect(scoreTool({ name: "fetch__fetch" }, "fetch__fetch")).toBeGreaterThan(
      scoreTool({ name: "fetch__fetcher" }, "fetch__fetch")
    );
    expect(scoreTool({ name: "time__now" }, "now")).toBeGreaterThan(
      scoreTool({ name: "time__nowhere" }, "now")
    );
  });

  it("is 0 when nothing matches", () => {
    expect(scoreTool({ name: "time__now", description: "Current time" }, "database")).toBe(0);
  });
});

describe("searchTools", () => {
  it("ranks the most relevant tools first", () => {
    const hits = searchTools(TOOLS, "create github issue");
    expect(hits[0]!.name).toBe("github__create_issue");
    expect(hits.every((h) => h.score > 0)).toBe(true);
  });

  it("finds tools by description words", () => {
    const hits = searchTools(TOOLS, "markdown");
    expect(hits.map((h) => h.name)).toEqual(["fetch__fetch"]);
  });

  it("returns only matching tools", () => {
    expect(searchTools(TOOLS, "kubernetes")).toEqual([]);
  });

  it("orders ties by name", () => {
    const hits = searchTools(TOOLS, "file");
    expect(hits.map((h) => h.name)).toEqual(["filesystem__read_file", "filesystem__write_file"]);
  });

  it("lists tools alphabetically for an empty query, up to the limit", () => {
    const hits = searchTools(TOOLS, "", 2);
    expect(hits.map((h) => h.name)).toEqual(["fetch__fetch", "filesystem__read_file"]);
    expect(hits.every((h) => h.score === 0)).toBe(true);
    expect(searchTools(TOOLS, undefined).length).toBe(TOOLS.length);
  });

  it("applies the limit", () => {
    expect(searchTools(TOOLS, "repository", 1)).toHaveLength(1);
  });

  it("returns name and description (empty when missing)", () => {
    const [hit] = searchTools([{ name: "x__y" }], "y");
    expect(hit).toEqual({ name: "x__y", description: "", score: expect.any(Number) });
  });
});

describe("clampSearchLimit", () => {
  it("defaults, floors and clamps", () => {
    expect(clampSearchLimit(undefined)).toBe(DEFAULT_SEARCH_LIMIT);
    expect(clampSearchLimit("abc")).toBe(DEFAULT_SEARCH_LIMIT);
    expect(clampSearchLimit(0)).toBe(1);
    expect(clampSearchLimit(-5)).toBe(1);
    expect(clampSearchLimit(3.9)).toBe(3);
    expect(clampSearchLimit("7")).toBe(7);
    expect(clampSearchLimit(1000)).toBe(MAX_SEARCH_LIMIT);
  });
});

describe("describeToolSchema", () => {
  it("returns name, description, input schema and annotations as JSON", () => {
    const parsed = JSON.parse(
      describeToolSchema({
        name: "fs__read",
        description: "Read",
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
        annotations: { readOnlyHint: true },
      })
    );
    expect(parsed).toEqual({
      name: "fs__read",
      description: "Read",
      inputSchema: { type: "object", properties: { path: { type: "string" } } },
      annotations: { readOnlyHint: true },
    });
  });

  it("fills a minimal schema when the tool declares none", () => {
    const parsed = JSON.parse(describeToolSchema({ name: "x__y" }));
    expect(parsed).toEqual({ name: "x__y", description: "", inputSchema: { type: "object" } });
  });
});

describe("isRouterMode", () => {
  it("reads ?mode=router, case-insensitively", () => {
    expect(isRouterMode(new URLSearchParams("mode=router"))).toBe(true);
    expect(isRouterMode(new URLSearchParams("mode=Router"))).toBe(true);
    expect(isRouterMode(new URLSearchParams("mode=all"))).toBe(false);
    expect(isRouterMode(new URLSearchParams(""))).toBe(false);
  });
});

describe("resolveToolCall (aggregated tools/call routing)", () => {
  const SLUGS = ["fetch", "github", "my__mcp"];

  it("routes <mcp>__<tool> to that MCP with its own tool name", () => {
    expect(
      resolveToolCall(
        { name: "fetch__fetch", arguments: { url: "https://x" }, _meta: { progressToken: 1 } },
        SLUGS,
        false
      )
    ).toEqual({
      kind: "forward",
      mcpSlug: "fetch",
      toolName: "fetch",
      params: { arguments: { url: "https://x" }, _meta: { progressToken: 1 } },
    });
  });

  it("resolves a slug that itself contains the separator", () => {
    const r = resolveToolCall({ name: "my__mcp__do_it" }, SLUGS, false);
    expect(r).toMatchObject({ kind: "forward", mcpSlug: "my__mcp", toolName: "do_it" });
  });

  it("refuses an unknown MCP prefix or a missing name", () => {
    expect(resolveToolCall({ name: "slack__post" }, SLUGS, false).kind).toBe("invalid");
    expect(resolveToolCall({ name: "fetch" }, SLUGS, false).kind).toBe("invalid");
    expect(resolveToolCall({}, SLUGS, false).kind).toBe("invalid");
    expect(resolveToolCall(undefined, SLUGS, false).kind).toBe("invalid");
    expect(resolveToolCall([1, 2], SLUGS, false).kind).toBe("invalid");
  });

  it("treats the meta-tool names as ordinary (unknown) tools outside router mode", () => {
    expect(resolveToolCall({ name: ROUTER_SEARCH_TOOL }, SLUGS, false).kind).toBe("invalid");
  });

  it("answers search_tools and get_tool_schema locally in router mode", () => {
    expect(
      resolveToolCall(
        { name: ROUTER_SEARCH_TOOL, arguments: { query: "issue", limit: 3 } },
        SLUGS,
        true
      )
    ).toEqual({ kind: "search", query: "issue", limit: 3 });
    expect(
      resolveToolCall(
        { name: ROUTER_SCHEMA_TOOL, arguments: { name: "fetch__fetch" } },
        SLUGS,
        true
      )
    ).toEqual({ kind: "schema", name: "fetch__fetch" });
    expect(resolveToolCall({ name: ROUTER_SCHEMA_TOOL }, SLUGS, true)).toEqual({
      kind: "schema",
      name: "",
    });
  });

  it("unwraps call_tool into a forwarded call, keeping _meta", () => {
    expect(
      resolveToolCall(
        {
          name: ROUTER_CALL_TOOL,
          arguments: { name: "github__create_issue", arguments: { title: "t" } },
          _meta: { progressToken: "p" },
        },
        SLUGS,
        true
      )
    ).toEqual({
      kind: "forward",
      mcpSlug: "github",
      toolName: "create_issue",
      params: { _meta: { progressToken: "p" }, arguments: { title: "t" } },
    });
    // No arguments: an empty object is forwarded.
    expect(
      resolveToolCall({ name: ROUTER_CALL_TOOL, arguments: { name: "fetch__fetch" } }, SLUGS, true)
    ).toMatchObject({ kind: "forward", params: { arguments: {} } });
  });

  it("refuses call_tool without a usable tool name", () => {
    const missing = resolveToolCall({ name: ROUTER_CALL_TOOL, arguments: {} }, SLUGS, true);
    expect(missing.kind).toBe("invalid");
    const unknown = resolveToolCall(
      { name: ROUTER_CALL_TOOL, arguments: { name: "nope__x" } },
      SLUGS,
      true
    );
    expect(unknown).toMatchObject({ kind: "invalid" });
    if (unknown.kind === "invalid") expect(unknown.message).toContain("search_tools");
  });

  it("still routes a direct <mcp>__<tool> call in router mode", () => {
    expect(resolveToolCall({ name: "fetch__fetch" }, SLUGS, true)).toMatchObject({
      kind: "forward",
      mcpSlug: "fetch",
      toolName: "fetch",
    });
  });
});
