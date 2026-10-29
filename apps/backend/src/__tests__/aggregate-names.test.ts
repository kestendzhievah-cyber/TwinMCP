import { describe, expect, it } from "vitest";
import {
  MAX_EXPOSED_TOOL_NAME,
  MAX_TOOLS_LIST_PAGES,
  buildIndexedToolsList,
  exposedToolName,
  isClientSafeToolName,
  mergePagedToolLists,
  mergeToolListsIndexed,
  nextCursorOf,
  shortNameHash,
  toolsListRequest,
} from "@/lib/mcp/aggregate";
import { resolveToolCall } from "@/lib/mcp/router-tools";

// Review fix: aggregated names must be client-safe (Claude / OpenAI / Cursor
// reject names outside ^[a-zA-Z0-9_-]{1,64}$) and still route back to the MCP.

const LONG_SLUG = "a".repeat(64);

describe("exposedToolName", () => {
  it("keeps a short, clean `<slug>__<tool>` as is", () => {
    expect(exposedToolName("github", "create_issue")).toBe("github__create_issue");
  });

  it("replaces characters outside [A-Za-z0-9_-]", () => {
    expect(exposedToolName("fs", "read.file")).toBe("fs__read_file");
    expect(exposedToolName("fs", "dir/list")).toBe("fs__dir_list");
    expect(isClientSafeToolName(exposedToolName("x", "é ü"))).toBe(true);
  });

  it("caps a long slug at 64 characters with a hash suffix", () => {
    const name = exposedToolName(LONG_SLUG, "run");
    expect(name.length).toBe(MAX_EXPOSED_TOOL_NAME);
    expect(name).toMatch(/_[0-9a-z]{6}$/);
    expect(isClientSafeToolName(name)).toBe(true);
  });

  it("caps a long tool name too, and keeps distinct tools distinct", () => {
    const a = exposedToolName("notion", `${"x".repeat(80)}_one`);
    const b = exposedToolName("notion", `${"x".repeat(80)}_two`);
    expect(a.length).toBe(64);
    expect(b.length).toBe(64);
    expect(a).not.toBe(b);
  });

  it("is deterministic (same tool, same name, every time)", () => {
    expect(exposedToolName(LONG_SLUG, "run")).toBe(exposedToolName(LONG_SLUG, "run"));
    expect(shortNameHash("abc")).toBe(shortNameHash("abc"));
    expect(shortNameHash("abc")).toMatch(/^[0-9a-z]{6}$/);
  });
});

describe("mergeToolListsIndexed", () => {
  it("indexes every exposed name back to its MCP and own tool name", () => {
    const { tools, index } = mergeToolListsIndexed([
      { mcpSlug: "fs", tools: [{ name: "read.file" }] },
      { mcpSlug: LONG_SLUG, tools: [{ name: "run" }] },
    ]);
    expect(tools.map((t) => t.name).every(isClientSafeToolName)).toBe(true);
    expect(index.get("fs__read_file")).toEqual({ mcpSlug: "fs", toolName: "read.file" });
    expect(index.get(tools[1]!.name)).toEqual({ mcpSlug: LONG_SLUG, toolName: "run" });
  });

  it("gives the second of two colliding safe names the hashed form, stably", () => {
    const lists = [{ mcpSlug: "fs", tools: [{ name: "read.file" }, { name: "read_file" }] }];
    const first = mergeToolListsIndexed(lists);
    const again = mergeToolListsIndexed(lists);
    expect(first.tools.map((t) => t.name)).toEqual(again.tools.map((t) => t.name));
    expect(first.tools).toHaveLength(2);
    expect(first.tools[0]!.name).toBe("fs__read_file");
    expect(first.tools[1]!.name).toMatch(/^fs__read_file_[0-9a-z]{6}$/);
    expect(first.index.get(first.tools[1]!.name)).toEqual({
      mcpSlug: "fs",
      toolName: "read_file",
    });
  });

  it("drops an exact duplicate", () => {
    const { tools } = mergeToolListsIndexed([
      { mcpSlug: "m", tools: [{ name: "t" }, { name: "t", description: "again" }] },
    ]);
    expect(tools).toEqual([{ name: "m__t" }]);
  });

  it("buildIndexedToolsList returns the same list as the result plus its index", () => {
    const { result, index } = buildIndexedToolsList([
      { mcpSlug: "fs", state: "ok", tools: [{ name: "a.b" }] },
    ]);
    expect(result.tools).toEqual([{ name: "fs__a_b" }]);
    expect(index.get("fs__a_b")).toEqual({ mcpSlug: "fs", toolName: "a.b" });
  });
});

describe("resolveToolCall with the exposed-name index", () => {
  const { index, tools } = mergeToolListsIndexed([
    { mcpSlug: "fs", tools: [{ name: "read.file" }] },
    { mcpSlug: LONG_SLUG, tools: [{ name: "run" }] },
  ]);
  const slugs = ["fs", LONG_SLUG];

  it("routes a rewritten name to the MCP's own tool name", () => {
    expect(
      resolveToolCall({ name: "fs__read_file", arguments: { p: 1 } }, slugs, false, index)
    ).toEqual({
      kind: "forward",
      mcpSlug: "fs",
      toolName: "read.file",
      params: { arguments: { p: 1 } },
    });
  });

  it("routes a hashed name", () => {
    const r = resolveToolCall({ name: tools[1]!.name }, slugs, false, index);
    expect(r).toEqual({ kind: "forward", mcpSlug: LONG_SLUG, toolName: "run", params: {} });
  });

  it("routes call_tool in router mode through the index", () => {
    const r = resolveToolCall(
      { name: "call_tool", arguments: { name: "fs__read_file", arguments: {} } },
      slugs,
      true,
      index
    );
    expect(r).toMatchObject({ kind: "forward", mcpSlug: "fs", toolName: "read.file" });
  });

  it("falls back to the plain split for a name the index does not know", () => {
    expect(resolveToolCall({ name: "fs__other" }, slugs, false, index)).toMatchObject({
      kind: "forward",
      mcpSlug: "fs",
      toolName: "other",
    });
  });

  it("ignores an index entry for an MCP no longer on the server", () => {
    expect(resolveToolCall({ name: "fs__read_file" }, [LONG_SLUG], false, index).kind).toBe(
      "invalid"
    );
  });
});

describe("tools/list pagination", () => {
  it("toolsListRequest carries the cursor of a later page", () => {
    expect(JSON.parse(toolsListRequest(2, "c2"))).toEqual({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: { cursor: "c2" },
    });
    expect(JSON.parse(toolsListRequest(1)).params).toEqual({});
  });

  it("nextCursorOf reads a non-empty result.nextCursor only", () => {
    expect(nextCursorOf({ id: 1, result: { tools: [], nextCursor: "abc" } })).toBe("abc");
    expect(nextCursorOf({ id: 1, result: { tools: [], nextCursor: "" } })).toBeNull();
    expect(nextCursorOf({ id: 1, result: { tools: [] } })).toBeNull();
    expect(nextCursorOf({ id: 1, error: {} })).toBeNull();
    expect(nextCursorOf(null)).toBeNull();
  });

  it("mergePagedToolLists concatenates pages, first definition wins", () => {
    expect(
      mergePagedToolLists([
        [{ name: "a" }, { name: "b", description: "page 1" }],
        [{ name: "b", description: "page 2" }, { name: "c" }],
      ])
    ).toEqual([{ name: "a" }, { name: "b", description: "page 1" }, { name: "c" }]);
    expect(mergePagedToolLists([])).toEqual([]);
  });

  it("reads a bounded number of pages", () => {
    expect(MAX_TOOLS_LIST_PAGES).toBeGreaterThan(1);
    expect(MAX_TOOLS_LIST_PAGES).toBeLessThanOrEqual(10);
  });
});
