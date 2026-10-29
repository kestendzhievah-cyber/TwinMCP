import { describe, it, expect } from "vitest";
import {
  applyPolicyToJsonRpcResponse,
  extractToolsFromTryResponse,
  filterToolsList,
  isToolCallAllowed,
  isUnrestricted,
  MAX_POLICY_TOOLS,
  MAX_TOOL_NAME_LENGTH,
  parseToolPolicy,
  policyNeedsToolAnnotations,
  toolDeniedMessage,
  type ToolPolicy,
} from "../lib/mcp/tool-policy";

const TOOLS = [
  { name: "read_file", annotations: { readOnlyHint: true } },
  { name: "write_file", annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: "list_dir", annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "search" }, // no annotations: not read-only
  { name: "fetch", annotations: {} },
];
const names = (ts: Array<{ name: string }>) => ts.map((t) => t.name);

describe("parseToolPolicy", () => {
  it("returns null for null, undefined, non-objects and arrays", () => {
    expect(parseToolPolicy(null)).toBeNull();
    expect(parseToolPolicy(undefined)).toBeNull();
    expect(parseToolPolicy(42)).toBeNull();
    expect(parseToolPolicy(true)).toBeNull();
    expect(parseToolPolicy([])).toBeNull();
    expect(parseToolPolicy([{ mode: "all" }])).toBeNull();
  });

  it("returns null for a missing or unknown mode", () => {
    expect(parseToolPolicy({})).toBeNull();
    expect(parseToolPolicy({ mode: "everything" })).toBeNull();
    expect(parseToolPolicy({ mode: "READ_ONLY" })).toBeNull();
    expect(parseToolPolicy({ deny: ["x"] })).toBeNull();
  });

  it("accepts a JSON string (and returns null for an unparseable one)", () => {
    expect(parseToolPolicy('{"mode":"read_only"}')).toEqual({ mode: "read_only" });
    expect(parseToolPolicy("{not json")).toBeNull();
    expect(parseToolPolicy('"all"')).toBeNull();
  });

  it("parses every mode", () => {
    expect(parseToolPolicy({ mode: "all" })).toEqual({ mode: "all" });
    expect(parseToolPolicy({ mode: "read_only" })).toEqual({ mode: "read_only" });
    expect(parseToolPolicy({ mode: "allow_list", allow: ["a"] })).toEqual({
      mode: "allow_list",
      allow: ["a"],
    });
  });

  it("gives allow_list an empty allow when missing or malformed", () => {
    expect(parseToolPolicy({ mode: "allow_list" })).toEqual({ mode: "allow_list", allow: [] });
    expect(parseToolPolicy({ mode: "allow_list", allow: "a" })).toEqual({
      mode: "allow_list",
      allow: [],
    });
  });

  it("drops `allow` outside allow_list mode and omits an empty deny", () => {
    expect(parseToolPolicy({ mode: "all", allow: ["a"], deny: [] })).toEqual({ mode: "all" });
    expect(parseToolPolicy({ mode: "read_only", allow: ["a"] })).toEqual({ mode: "read_only" });
  });

  it("normalizes names: trims, de-duplicates, drops non-strings, empties and over-long ones", () => {
    const long = "x".repeat(MAX_TOOL_NAME_LENGTH + 1);
    expect(
      parseToolPolicy({
        mode: "allow_list",
        allow: [" a ", "a", "", "   ", 3, null, { name: "b" }, long, "b"],
        deny: ["c", "c", " d"],
      })
    ).toEqual({ mode: "allow_list", allow: ["a", "b"], deny: ["c", "d"] });
  });

  it("caps list length", () => {
    const many = Array.from({ length: MAX_POLICY_TOOLS + 50 }, (_, i) => `t${i}`);
    const p = parseToolPolicy({ mode: "allow_list", allow: many, deny: many });
    expect(p?.allow).toHaveLength(MAX_POLICY_TOOLS);
    expect(p?.deny).toHaveLength(MAX_POLICY_TOOLS);
  });

  it("ignores unknown extra keys", () => {
    expect(parseToolPolicy({ mode: "all", deny: ["x"], extra: 1 })).toEqual({
      mode: "all",
      deny: ["x"],
    });
  });
});

describe("isUnrestricted / policyNeedsToolAnnotations", () => {
  it("is unrestricted for null and for all-without-deny", () => {
    expect(isUnrestricted(null)).toBe(true);
    expect(isUnrestricted(undefined)).toBe(true);
    expect(isUnrestricted({ mode: "all" })).toBe(true);
    expect(isUnrestricted({ mode: "all", deny: [] })).toBe(true);
  });

  it("is restricted for a deny list or any other mode", () => {
    expect(isUnrestricted({ mode: "all", deny: ["x"] })).toBe(false);
    expect(isUnrestricted({ mode: "read_only" })).toBe(false);
    expect(isUnrestricted({ mode: "allow_list", allow: ["a"] })).toBe(false);
  });

  it("needs annotations only in read_only mode", () => {
    expect(policyNeedsToolAnnotations(null)).toBe(false);
    expect(policyNeedsToolAnnotations({ mode: "all", deny: ["x"] })).toBe(false);
    expect(policyNeedsToolAnnotations({ mode: "allow_list", allow: [] })).toBe(false);
    expect(policyNeedsToolAnnotations({ mode: "read_only" })).toBe(true);
  });
});

describe("filterToolsList", () => {
  it("returns the very same array when unrestricted", () => {
    expect(filterToolsList(TOOLS, null)).toBe(TOOLS);
    expect(filterToolsList(TOOLS, { mode: "all" })).toBe(TOOLS);
  });

  it("all + deny removes only the denied tools", () => {
    expect(names(filterToolsList(TOOLS, { mode: "all", deny: ["write_file", "nope"] }))).toEqual([
      "read_file",
      "list_dir",
      "search",
      "fetch",
    ]);
  });

  it("read_only keeps only readOnlyHint === true", () => {
    expect(names(filterToolsList(TOOLS, { mode: "read_only" }))).toEqual(["read_file", "list_dir"]);
  });

  it("read_only treats truthy non-boolean hints and null annotations as not read-only", () => {
    const tools = [
      { name: "a", annotations: { readOnlyHint: "true" as unknown as boolean } },
      { name: "b", annotations: null },
      { name: "c", annotations: { readOnlyHint: true } },
    ];
    expect(names(filterToolsList(tools, { mode: "read_only" }))).toEqual(["c"]);
  });

  it("allow_list keeps only the listed names, in the original order", () => {
    expect(
      names(filterToolsList(TOOLS, { mode: "allow_list", allow: ["search", "read_file"] }))
    ).toEqual(["read_file", "search"]);
  });

  it("an empty allow_list hides everything", () => {
    expect(filterToolsList(TOOLS, { mode: "allow_list", allow: [] })).toEqual([]);
  });

  it("deny wins over allow and over readOnlyHint", () => {
    expect(
      names(
        filterToolsList(TOOLS, {
          mode: "allow_list",
          allow: ["read_file", "search"],
          deny: ["read_file"],
        })
      )
    ).toEqual(["search"]);
    expect(names(filterToolsList(TOOLS, { mode: "read_only", deny: ["list_dir"] }))).toEqual([
      "read_file",
    ]);
  });

  it("matches names exactly (case-sensitive)", () => {
    expect(names(filterToolsList(TOOLS, { mode: "allow_list", allow: ["READ_FILE"] }))).toEqual([]);
  });

  it("does not mutate its input", () => {
    const copy = JSON.parse(JSON.stringify(TOOLS));
    filterToolsList(TOOLS, { mode: "read_only", deny: ["read_file"] });
    expect(TOOLS).toEqual(copy);
  });
});

describe("isToolCallAllowed", () => {
  it("allows anything when unrestricted", () => {
    expect(isToolCallAllowed("anything", null)).toBe(true);
    expect(isToolCallAllowed("anything", { mode: "all" })).toBe(true);
  });

  it("all + deny refuses only denied tools (unknown tools pass)", () => {
    const p: ToolPolicy = { mode: "all", deny: ["write_file"] };
    expect(isToolCallAllowed("write_file", p)).toBe(false);
    expect(isToolCallAllowed("read_file", p)).toBe(true);
    expect(isToolCallAllowed("never_listed", p)).toBe(true);
  });

  it("allow_list allows only listed tools, deny wins", () => {
    const p: ToolPolicy = { mode: "allow_list", allow: ["read_file", "search"], deny: ["search"] };
    expect(isToolCallAllowed("read_file", p)).toBe(true);
    expect(isToolCallAllowed("search", p)).toBe(false);
    expect(isToolCallAllowed("write_file", p)).toBe(false);
    expect(isToolCallAllowed("unknown_tool", p)).toBe(false);
  });

  it("read_only consults knownTools", () => {
    const p: ToolPolicy = { mode: "read_only" };
    expect(isToolCallAllowed("read_file", p, TOOLS)).toBe(true);
    expect(isToolCallAllowed("write_file", p, TOOLS)).toBe(false);
    expect(isToolCallAllowed("search", p, TOOLS)).toBe(false);
    expect(isToolCallAllowed("fetch", p, TOOLS)).toBe(false);
  });

  it("read_only fails closed for unknown tools and without knownTools", () => {
    const p: ToolPolicy = { mode: "read_only" };
    expect(isToolCallAllowed("not_listed", p, TOOLS)).toBe(false);
    expect(isToolCallAllowed("read_file", p)).toBe(false);
    expect(isToolCallAllowed("read_file", p, null)).toBe(false);
    expect(isToolCallAllowed("read_file", p, [])).toBe(false);
  });

  it("read_only + deny: deny wins even over a read-only tool", () => {
    expect(isToolCallAllowed("read_file", { mode: "read_only", deny: ["read_file"] }, TOOLS)).toBe(
      false
    );
  });

  it("refuses an empty or non-string name under a restrictive policy", () => {
    expect(isToolCallAllowed("", { mode: "all", deny: ["x"] })).toBe(false);
    expect(isToolCallAllowed(undefined as unknown as string, { mode: "read_only" }, TOOLS)).toBe(
      false
    );
  });
});

describe("toolDeniedMessage", () => {
  it("names the tool and the reason", () => {
    expect(toolDeniedMessage("rm", { mode: "all", deny: ["rm"] })).toContain("deny list");
    expect(toolDeniedMessage("rm", { mode: "read_only" })).toContain("read-only");
    expect(toolDeniedMessage("rm", { mode: "allow_list", allow: [] })).toContain("allow-list");
    expect(toolDeniedMessage("rm", { mode: "read_only" })).toContain('"rm"');
  });

  it("quotes the name safely", () => {
    expect(toolDeniedMessage('a"b', null)).toContain('"a\\"b"');
  });
});

describe("applyPolicyToJsonRpcResponse — JSON bodies", () => {
  const listResponse = {
    jsonrpc: "2.0",
    id: 7,
    result: { tools: TOOLS, nextCursor: "abc" },
  };
  const body = JSON.stringify(listResponse);

  it("returns the body untouched when unrestricted", () => {
    expect(applyPolicyToJsonRpcResponse(body, null)).toBe(body);
    expect(applyPolicyToJsonRpcResponse(body, { mode: "all" })).toBe(body);
  });

  it("filters a tools/list result and keeps every other field", () => {
    const out = JSON.parse(applyPolicyToJsonRpcResponse(body, { mode: "read_only" }));
    expect(out.id).toBe(7);
    expect(out.jsonrpc).toBe("2.0");
    expect(out.result.nextCursor).toBe("abc");
    expect(names(out.result.tools)).toEqual(["read_file", "list_dir"]);
    // annotations survive the round trip
    expect(out.result.tools[0].annotations).toEqual({ readOnlyHint: true });
  });

  it("returns the original string when nothing is filtered out", () => {
    const spaced = JSON.stringify(listResponse, null, 2);
    expect(applyPolicyToJsonRpcResponse(spaced, { mode: "all", deny: ["absent"] })).toBe(spaced);
  });

  it("leaves non-tools/list responses untouched", () => {
    const call = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [] } });
    const err = JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "x" } });
    const notif = JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
    const p: ToolPolicy = { mode: "allow_list", allow: [] };
    expect(applyPolicyToJsonRpcResponse(call, p)).toBe(call);
    expect(applyPolicyToJsonRpcResponse(err, p)).toBe(err);
    expect(applyPolicyToJsonRpcResponse(notif, p)).toBe(notif);
  });

  it("passes invalid JSON, empty bodies and non-array tools through", () => {
    const p: ToolPolicy = { mode: "read_only" };
    expect(applyPolicyToJsonRpcResponse("{oops", p)).toBe("{oops");
    expect(applyPolicyToJsonRpcResponse("", p)).toBe("");
    expect(applyPolicyToJsonRpcResponse("plain text", p)).toBe("plain text");
    const weird = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: "nope" } });
    expect(applyPolicyToJsonRpcResponse(weird, p)).toBe(weird);
    const nullResult = JSON.stringify({ jsonrpc: "2.0", id: 1, result: null });
    expect(applyPolicyToJsonRpcResponse(nullResult, p)).toBe(nullResult);
  });

  it("drops malformed tool entries under a restrictive policy", () => {
    const b = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [null, 3, { noName: true }, { name: "read_file" }] },
    });
    const out = JSON.parse(
      applyPolicyToJsonRpcResponse(b, { mode: "allow_list", allow: ["read_file"] })
    );
    expect(out.result.tools).toEqual([{ name: "read_file" }]);
  });

  it("filters tools/list results inside a batch and leaves other elements alone", () => {
    const batch = [
      { jsonrpc: "2.0", id: 1, result: { tools: TOOLS } },
      { jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: "hi" }] } },
      { jsonrpc: "2.0", id: 3, error: { code: -1, message: "x" } },
    ];
    const out = JSON.parse(
      applyPolicyToJsonRpcResponse(JSON.stringify(batch), {
        mode: "allow_list",
        allow: ["search"],
      })
    );
    expect(out).toHaveLength(3);
    expect(names(out[0].result.tools)).toEqual(["search"]);
    expect(out[1]).toEqual(batch[1]);
    expect(out[2]).toEqual(batch[2]);
  });

  it("returns a batch untouched when no element changes", () => {
    const batch = JSON.stringify([{ jsonrpc: "2.0", id: 1, result: { content: [] } }]);
    expect(applyPolicyToJsonRpcResponse(batch, { mode: "read_only" })).toBe(batch);
  });

  it("tolerates leading whitespace", () => {
    const out = applyPolicyToJsonRpcResponse(`\n  ${body}`, { mode: "read_only" });
    expect(names(JSON.parse(out).result.tools)).toEqual(["read_file", "list_dir"]);
  });
});

describe("applyPolicyToJsonRpcResponse — SSE bodies", () => {
  const msg = { jsonrpc: "2.0", id: 2, result: { tools: TOOLS } };
  const p: ToolPolicy = { mode: "read_only", deny: ["list_dir"] };

  function dataOf(sse: string): unknown[] {
    return sse
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => JSON.parse(l.slice(5).trim()));
  }

  it("rewrites a single data frame and keeps event/id lines", () => {
    const sse = `event: message\nid: 42\ndata: ${JSON.stringify(msg)}\n\n`;
    const out = applyPolicyToJsonRpcResponse(sse, p);
    expect(out.startsWith("event: message\nid: 42\ndata: ")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(true);
    const [first] = dataOf(out) as Array<typeof msg>;
    expect(names(first!.result.tools)).toEqual(["read_file"]);
  });

  it("handles `data:` without a space and CRLF line endings", () => {
    const sse = `event: message\r\ndata:${JSON.stringify(msg)}\r\n\r\n`;
    const out = applyPolicyToJsonRpcResponse(sse, p);
    expect(out).toContain("\r\n\r\n");
    expect(out.startsWith("event: message\r\ndata: ")).toBe(true);
    const [first] = dataOf(out) as Array<typeof msg>;
    expect(names(first!.result.tools)).toEqual(["read_file"]);
  });

  it("joins a multi-line data payload and replaces it with one line", () => {
    const pretty = JSON.stringify(msg, null, 2).split("\n");
    const sse = `event: message\n${pretty.map((l) => `data: ${l}`).join("\n")}\n\n`;
    const out = applyPolicyToJsonRpcResponse(sse, p);
    const dataLines = out.split("\n").filter((l) => l.startsWith("data:"));
    expect(dataLines).toHaveLength(1);
    const parsed = JSON.parse(dataLines[0]!.slice(5).trim());
    expect(names(parsed.result.tools)).toEqual(["read_file"]);
  });

  it("only touches the tools/list event among several", () => {
    const other = { jsonrpc: "2.0", method: "notifications/message", params: { level: "info" } };
    const sse =
      `: keep-alive comment\n\n` +
      `event: message\ndata: ${JSON.stringify(other)}\n\n` +
      `event: message\ndata: ${JSON.stringify(msg)}\n\n`;
    const out = applyPolicyToJsonRpcResponse(sse, p);
    expect(
      out.startsWith(`: keep-alive comment\n\nevent: message\ndata: ${JSON.stringify(other)}\n\n`)
    ).toBe(true);
    const data = dataOf(out) as Array<{ result?: { tools: Array<{ name: string }> } }>;
    expect(data).toHaveLength(2);
    expect(names(data[1]!.result!.tools)).toEqual(["read_file"]);
  });

  it("handles a final event without a trailing blank line", () => {
    const sse = `event: message\ndata: ${JSON.stringify(msg)}`;
    const out = applyPolicyToJsonRpcResponse(sse, p);
    const [first] = dataOf(out) as Array<typeof msg>;
    expect(names(first!.result.tools)).toEqual(["read_file"]);
  });

  it("returns SSE untouched when no frame is a tools/list result or a frame is invalid", () => {
    const sse1 = `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })}\n\n`;
    const sse2 = `event: message\ndata: {not json\n\n`;
    const sse3 = `event: ping\n\n`;
    expect(applyPolicyToJsonRpcResponse(sse1, p)).toBe(sse1);
    expect(applyPolicyToJsonRpcResponse(sse2, p)).toBe(sse2);
    expect(applyPolicyToJsonRpcResponse(sse3, p)).toBe(sse3);
  });

  it("returns SSE untouched when the policy filters nothing", () => {
    const sse = `event: message\ndata: ${JSON.stringify(msg)}\n\n`;
    expect(applyPolicyToJsonRpcResponse(sse, { mode: "all", deny: ["absent"] })).toBe(sse);
  });
});

describe("extractToolsFromTryResponse", () => {
  const rpc = { jsonrpc: "2.0", id: 1, result: { tools: TOOLS } };

  it("reads a bare {tools}, a JSON-RPC message and common wrappers", () => {
    expect(names(extractToolsFromTryResponse({ tools: TOOLS })!)).toEqual(names(TOOLS));
    expect(names(extractToolsFromTryResponse(rpc)!)).toEqual(names(TOOLS));
    expect(names(extractToolsFromTryResponse({ response: rpc })!)).toEqual(names(TOOLS));
    expect(names(extractToolsFromTryResponse({ ok: true, data: rpc })!)).toEqual(names(TOOLS));
    expect(names(extractToolsFromTryResponse({ result: { tools: TOOLS } })!)).toEqual(names(TOOLS));
  });

  it("reads a raw JSON or SSE text body", () => {
    expect(names(extractToolsFromTryResponse({ body: JSON.stringify(rpc) })!)).toEqual(
      names(TOOLS)
    );
    expect(
      names(extractToolsFromTryResponse(`event: message\ndata: ${JSON.stringify(rpc)}\n\n`)!)
    ).toEqual(names(TOOLS));
  });

  it("keeps title, description and boolean annotations only", () => {
    const [t] = extractToolsFromTryResponse({
      tools: [
        {
          name: "x",
          title: "X",
          description: "does x",
          inputSchema: { type: "object" },
          annotations: { readOnlyHint: true, destructiveHint: "no", openWorldHint: false },
        },
      ],
    })!;
    expect(t).toEqual({
      name: "x",
      title: "X",
      description: "does x",
      annotations: { readOnlyHint: true, openWorldHint: false },
    });
  });

  it("drops nameless entries and duplicates", () => {
    const out = extractToolsFromTryResponse({
      tools: [{ name: "a" }, { name: "" }, null, { name: "a" }, { title: "b" }],
    });
    expect(out).toEqual([{ name: "a" }]);
  });

  it("narrows an aggregated list to one MCP and strips its prefix", () => {
    const out = extractToolsFromTryResponse(
      { tools: [{ name: "github__create_issue" }, { name: "fs__read_file" }, { name: "fs__x" }] },
      "fs"
    );
    expect(names(out!)).toEqual(["read_file", "x"]);
  });

  it("leaves unprefixed names alone when given a slug", () => {
    expect(names(extractToolsFromTryResponse({ tools: TOOLS }, "fs")!)).toEqual(names(TOOLS));
  });

  it("returns null when there is no tool list", () => {
    expect(extractToolsFromTryResponse(null)).toBeNull();
    expect(extractToolsFromTryResponse({ error: { message: "asleep" } })).toBeNull();
    expect(extractToolsFromTryResponse("not json")).toBeNull();
    expect(extractToolsFromTryResponse({ result: { content: [] } })).toBeNull();
  });

  it("returns an empty array for an empty tool list", () => {
    expect(extractToolsFromTryResponse({ tools: [] })).toEqual([]);
  });
});
