import { describe, it, expect } from "vitest";
import {
  SUPPORTED_PROTOCOL_VERSIONS,
  TOOL_POLICY_DENIED_CODE,
  ToolCache,
  WARNINGS_META_KEY,
  aggregateInitializeResult,
  buildForwardedToolCall,
  buildToolsListResult,
  extractJsonRpcResponse,
  mergeToolLists,
  mergeToolsListPages,
  negotiateProtocolVersion,
  parseRpcBody,
  prefixToolName,
  sanitizeTools,
  shouldAnswerWaking,
  splitToolName,
  toolCallName,
  toolCallStatusFor,
  toolsFromResponse,
  toolsListRequest,
  type FanoutEntry,
} from "@/lib/mcp/aggregate";

describe("prefixToolName / splitToolName", () => {
  it("prefixes with the MCP slug and a double underscore", () => {
    expect(prefixToolName("fetch", "fetch_url")).toBe("fetch__fetch_url");
  });

  it("round-trips through splitToolName", () => {
    const name = prefixToolName("github", "create_issue");
    expect(splitToolName(name)).toEqual({ mcpSlug: "github", toolName: "create_issue" });
  });

  it("splits at the first separator without known slugs", () => {
    expect(splitToolName("a__b__c")).toEqual({ mcpSlug: "a", toolName: "b__c" });
  });

  it("rejects names without a usable prefix", () => {
    expect(splitToolName("plain")).toBeNull();
    expect(splitToolName("__tool")).toBeNull();
    expect(splitToolName("mcp__")).toBeNull();
    expect(splitToolName("")).toBeNull();
  });

  it("prefers the longest known slug (slugs or tools containing __)", () => {
    const slugs = ["my", "my__mcp", "other"];
    expect(splitToolName("my__mcp__run", slugs)).toEqual({ mcpSlug: "my__mcp", toolName: "run" });
    expect(splitToolName("my__run", slugs)).toEqual({ mcpSlug: "my", toolName: "run" });
    expect(splitToolName("other__a__b", slugs)).toEqual({ mcpSlug: "other", toolName: "a__b" });
  });

  it("returns null for an unknown slug when slugs are given", () => {
    expect(splitToolName("ghost__run", ["fetch"])).toBeNull();
    expect(splitToolName("fetch__", ["fetch"])).toBeNull();
  });
});

describe("mergeToolLists", () => {
  it("prefixes names, keeps every other field and the input order", () => {
    const merged = mergeToolLists([
      {
        mcpSlug: "fetch",
        tools: [
          {
            name: "fetch",
            description: "Fetch a URL",
            inputSchema: { type: "object" },
            annotations: { readOnlyHint: true },
          },
        ],
      },
      { mcpSlug: "time", tools: [{ name: "now" }, { name: "convert", title: "Convert" }] },
    ]);
    expect(merged.map((t) => t.name)).toEqual(["fetch__fetch", "time__now", "time__convert"]);
    expect(merged[0]).toEqual({
      name: "fetch__fetch",
      description: "Fetch a URL",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true },
    });
    expect(merged[2]!.title).toBe("Convert");
  });

  it("drops malformed entries and duplicate aggregated names", () => {
    const merged = mergeToolLists([
      {
        mcpSlug: "x",
        tools: [{ name: "a" }, { name: "" }, null, "str", { nope: 1 }, { name: "a" }],
      },
      { mcpSlug: "y", tools: "not an array" },
    ]);
    expect(merged.map((t) => t.name)).toEqual(["x__a"]);
  });

  it("does not mutate the input tools", () => {
    const tool = { name: "a" };
    mergeToolLists([{ mcpSlug: "m", tools: [tool] }]);
    expect(tool.name).toBe("a");
  });

  it("sanitizeTools keeps only named objects", () => {
    expect(sanitizeTools([{ name: "ok" }, { name: 3 }, [], undefined])).toEqual([{ name: "ok" }]);
    expect(sanitizeTools(undefined)).toEqual([]);
  });
});

describe("JSON-RPC bodies", () => {
  it("parseRpcBody tells single, batch and invalid apart", () => {
    expect(parseRpcBody('{"jsonrpc":"2.0","id":1,"method":"ping"}')).toEqual({
      kind: "single",
      message: { jsonrpc: "2.0", id: 1, method: "ping" },
    });
    expect(parseRpcBody("[]").kind).toBe("batch");
    expect(parseRpcBody("not json").kind).toBe("invalid");
    expect(parseRpcBody("").kind).toBe("invalid");
    expect(parseRpcBody("42").kind).toBe("invalid");
    expect(parseRpcBody(undefined).kind).toBe("invalid");
  });

  it("toolCallName reads params.name of a tools/call only", () => {
    expect(
      toolCallName('{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch"}}')
    ).toBe("fetch");
    expect(toolCallName('{"method":"tools/list","params":{"name":"x"}}')).toBeNull();
    expect(toolCallName('{"method":"tools/call","params":{}}')).toBeNull();
    expect(toolCallName('[{"method":"tools/call","params":{"name":"x"}}]')).toBeNull();
    expect(toolCallName(null)).toBeNull();
  });

  it("buildForwardedToolCall swaps the name, keeps id, arguments and _meta", () => {
    const body = JSON.parse(
      buildForwardedToolCall(
        7,
        { name: "fetch__fetch", arguments: { url: "https://x" }, _meta: { progressToken: 1 } },
        "fetch"
      )
    );
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "fetch", arguments: { url: "https://x" }, _meta: { progressToken: 1 } },
    });
    expect(JSON.parse(buildForwardedToolCall({ bad: 1 }, undefined, "t")).id).toBeNull();
  });

  it("toolsListRequest is a tools/list request", () => {
    expect(JSON.parse(toolsListRequest(3))).toEqual({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    });
  });
});

describe("extractJsonRpcResponse", () => {
  it("reads a JSON body", () => {
    const msg = extractJsonRpcResponse(
      '{"jsonrpc":"2.0","id":1,"result":{"ok":true}}',
      "application/json"
    );
    expect(msg).toEqual({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  });

  it("reads the response out of an SSE stream, skipping notifications", () => {
    const sse = [
      "event: message",
      'data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}',
      "",
      "event: message",
      'data: {"jsonrpc":"2.0","id":5,"result":{"content":[]}}',
      "",
      "",
    ].join("\n");
    expect(extractJsonRpcResponse(sse, "text/event-stream", 5)).toEqual({
      jsonrpc: "2.0",
      id: 5,
      result: { content: [] },
    });
  });

  it("joins multi-line data payloads and handles CRLF", () => {
    const sse = 'data: {"jsonrpc":"2.0",\r\ndata: "id":2,"result":{}}\r\n\r\n';
    expect(extractJsonRpcResponse(sse, "text/event-stream")).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: {},
    });
  });

  it("prefers the message with the requested id", () => {
    const body = JSON.stringify([
      { jsonrpc: "2.0", id: 1, result: "a" },
      { jsonrpc: "2.0", id: 2, result: "b" },
    ]);
    expect(extractJsonRpcResponse(body, "application/json", 1)?.result).toBe("a");
    expect(extractJsonRpcResponse(body, "application/json")?.result).toBe("b");
  });

  it("keeps a JSON-RPC error response", () => {
    const msg = extractJsonRpcResponse(
      '{"jsonrpc":"2.0","id":1,"error":{"code":-1,"message":"x"}}'
    );
    expect(msg?.error).toEqual({ code: -1, message: "x" });
  });

  it("returns null when there is no response", () => {
    expect(extractJsonRpcResponse("", "application/json")).toBeNull();
    expect(extractJsonRpcResponse("garbage", "text/plain")).toBeNull();
    expect(extractJsonRpcResponse('{"jsonrpc":"2.0","method":"x"}')).toBeNull();
    expect(extractJsonRpcResponse("data: not json\n\n", "text/event-stream")).toBeNull();
  });

  it("toolsFromResponse reads result.tools", () => {
    expect(toolsFromResponse({ id: 1, result: { tools: [{ name: "a" }, { x: 1 }] } })).toEqual([
      { name: "a" },
    ]);
    expect(toolsFromResponse({ id: 1, result: {} })).toBeNull();
    expect(toolsFromResponse({ id: 1, error: {} })).toBeNull();
    expect(toolsFromResponse(null)).toBeNull();
  });
});

describe("initialize", () => {
  it("echoes a supported protocol version, else offers the latest", () => {
    expect(negotiateProtocolVersion("2025-03-26")).toBe("2025-03-26");
    const latest = SUPPORTED_PROTOCOL_VERSIONS[SUPPORTED_PROTOCOL_VERSIONS.length - 1];
    expect(negotiateProtocolVersion("1999-01-01")).toBe(latest);
    expect(negotiateProtocolVersion(undefined)).toBe(latest);
  });

  it("answers as TwinMCP with the tools capability", () => {
    const r = aggregateInitializeResult("2024-11-05");
    expect(r.protocolVersion).toBe("2024-11-05");
    expect(r.serverInfo.name).toBe("TwinMCP");
    expect(r.capabilities).toEqual({ tools: { listChanged: false } });
    expect(r.instructions).toContain("<mcp>__<tool>");
  });

  it("explains the meta-tools in router mode", () => {
    const r = aggregateInitializeResult("2024-11-05", { router: true });
    expect(r.instructions).toContain("search_tools");
    expect(r.instructions).toContain("call_tool");
  });
});

describe("fan-out result", () => {
  const ok: FanoutEntry = { mcpSlug: "fetch", state: "ok", tools: [{ name: "fetch" }] };
  const waking: FanoutEntry = {
    mcpSlug: "memory",
    state: "waking",
    tools: [{ name: "remember" }],
    reason: "waking",
  };
  const wakingEmpty: FanoutEntry = { mcpSlug: "time", state: "waking", tools: [] };
  const down: FanoutEntry = { mcpSlug: "db", state: "unavailable", tools: [], reason: "offline" };

  it("lists every tool and no _meta when all MCPs answered", () => {
    expect(buildToolsListResult([ok])).toEqual({ tools: [{ name: "fetch__fetch" }] });
  });

  it("keeps stale tools of a waking MCP and warns about it", () => {
    const r = buildToolsListResult([ok, waking, wakingEmpty, down]);
    expect(r.tools.map((t) => t.name)).toEqual(["fetch__fetch", "memory__remember"]);
    const warnings = r._meta?.[WARNINGS_META_KEY] as Array<{
      mcp: string;
      state: string;
      message: string;
    }>;
    expect(warnings.map((w) => [w.mcp, w.state])).toEqual([
      ["memory", "waking"],
      ["time", "waking"],
      ["db", "unavailable"],
    ]);
    expect(warnings[0]!.message).toBe("waking");
    expect(warnings[1]!.message).toMatch(/waking up/);
    expect(warnings[2]!.message).toBe("offline");
  });

  it("answers a retryable 503 only when nothing is listable and something is waking", () => {
    expect(shouldAnswerWaking([wakingEmpty])).toBe(true);
    expect(shouldAnswerWaking([wakingEmpty, down])).toBe(true);
    expect(shouldAnswerWaking([wakingEmpty, ok])).toBe(false);
    expect(shouldAnswerWaking([waking])).toBe(false);
    expect(shouldAnswerWaking([down])).toBe(false);
    expect(shouldAnswerWaking([])).toBe(false);
  });
});

describe("toolCallStatusFor (activity log, contract D1)", () => {
  it("maps the answer to a status and an error code", () => {
    expect(toolCallStatusFor(200)).toEqual({ status: "ok", errorCode: null });
    expect(toolCallStatusFor(202)).toEqual({ status: "ok", errorCode: null });
    expect(toolCallStatusFor(429)).toEqual({ status: "rate_limited", errorCode: 429 });
    expect(toolCallStatusFor(503)).toEqual({ status: "error", errorCode: 503 });
    expect(toolCallStatusFor(403)).toEqual({ status: "error", errorCode: 403 });
  });

  it("a policy refusal is denied, whatever the HTTP status", () => {
    expect(toolCallStatusFor(200, TOOL_POLICY_DENIED_CODE)).toEqual({
      status: "denied",
      errorCode: TOOL_POLICY_DENIED_CODE,
    });
    expect(toolCallStatusFor(200, null)).toEqual({ status: "ok", errorCode: null });
  });

  it("uses the contract's JSON-RPC code for a policy refusal", () => {
    expect(TOOL_POLICY_DENIED_CODE).toBe(-32007);
  });
});

describe("ToolCache", () => {
  it("returns entries younger than maxAge only", () => {
    const c = new ToolCache();
    c.set("a", [{ name: "x" }], 1_000);
    expect(c.get("a", 500, 1_400)).toEqual([{ name: "x" }]);
    expect(c.get("a", 500, 1_600)).toBeNull();
    expect(c.get("missing", 500, 1_000)).toBeNull();
  });

  it("evicts the oldest entry past its bound, refreshing on set", () => {
    const c = new ToolCache(2);
    c.set("a", [], 1);
    c.set("b", [], 2);
    c.set("a", [], 3); // a becomes the newest
    c.set("c", [], 4); // evicts b
    expect(c.size).toBe(2);
    expect(c.get("b", 1e9, 5)).toBeNull();
    expect(c.get("a", 1e9, 5)).toEqual([]);
    c.delete("a");
    expect(c.get("a", 1e9, 5)).toBeNull();
  });
});

describe("mergeToolsListPages (paginated tools/list)", () => {
  it("returns null without pages", () => {
    expect(mergeToolsListPages([])).toBeNull();
  });

  it("keeps the first envelope, concatenates tools and drops nextCursor", () => {
    const merged = mergeToolsListPages([
      {
        jsonrpc: "2.0",
        id: "a",
        result: { tools: [{ name: "x" }, { name: "y" }], nextCursor: "c1", _meta: { k: 1 } },
      },
      {
        jsonrpc: "2.0",
        id: "a-p1",
        result: { tools: [{ name: "y", description: "dup" }, { name: "z" }] },
      },
    ]);
    expect(merged).toEqual({
      jsonrpc: "2.0",
      id: "a",
      result: { tools: [{ name: "x" }, { name: "y" }, { name: "z" }], _meta: { k: 1 } },
    });
  });

  it("ignores malformed tools and results", () => {
    const merged = mergeToolsListPages([
      { id: 1, result: { tools: [{ name: "" }, null, "x", { name: "ok" }] } },
      { id: 2, result: "nope" },
    ]);
    expect(merged).toEqual({ id: 1, result: { tools: [{ name: "ok" }] } });
  });
});
