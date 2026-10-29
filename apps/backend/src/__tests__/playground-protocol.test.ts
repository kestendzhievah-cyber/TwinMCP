import { describe, expect, it } from "vitest";
import {
  MAX_ARGUMENTS_BYTES,
  WAKE_RETRY_WINDOW_MS,
  extractTools,
  isToolResultError,
  needsConfirmation,
  nextRetryDelayMs,
  parseJsonRpcPayload,
  parseTryBody,
  resultTexts,
  searchTools,
  sseDataFrames,
  toolBadges,
} from "@/app/dashboard/servers/[id]/try/protocol";

describe("parseTryBody", () => {
  it("accepts a tools/list and drops call-only fields", () => {
    expect(parseTryBody({ mcpSlug: "github", method: "tools/list", name: "x" })).toEqual({
      ok: true,
      body: { mcpSlug: "github", method: "tools/list" },
    });
  });

  it("accepts a tools/call with arguments, defaulting them to {}", () => {
    expect(
      parseTryBody({ mcpSlug: "fs", method: "tools/call", name: "read", arguments: { p: 1 } })
    ).toEqual({
      ok: true,
      body: { mcpSlug: "fs", method: "tools/call", name: "read", arguments: { p: 1 } },
    });
    const noArgs = parseTryBody({ mcpSlug: "fs", method: "tools/call", name: "ping" });
    expect(noArgs.ok && noArgs.body.arguments).toEqual({});
  });

  it("refuses bad input", () => {
    expect(parseTryBody(null).ok).toBe(false);
    expect(parseTryBody([]).ok).toBe(false);
    expect(parseTryBody({ method: "tools/list" }).ok).toBe(false);
    expect(parseTryBody({ mcpSlug: "../x", method: "tools/list" }).ok).toBe(false);
    expect(parseTryBody({ mcpSlug: "a", method: "initialize" }).ok).toBe(false);
    expect(parseTryBody({ mcpSlug: "a", method: "tools/call" }).ok).toBe(false);
    expect(parseTryBody({ mcpSlug: "a", method: "tools/call", name: " " }).ok).toBe(false);
    expect(parseTryBody({ mcpSlug: "a", method: "tools/call", name: "t", arguments: [1] }).ok).toBe(
      false
    );
  });

  it("caps the size of the arguments", () => {
    const big = { blob: "x".repeat(MAX_ARGUMENTS_BYTES) };
    expect(parseTryBody({ mcpSlug: "a", method: "tools/call", name: "t", arguments: big }).ok).toBe(
      false
    );
  });
});

describe("parseJsonRpcPayload", () => {
  const response = { jsonrpc: "2.0", id: "r1", result: { ok: true } };

  it("reads a plain JSON response", () => {
    expect(parseJsonRpcPayload(JSON.stringify(response), "application/json", "r1")).toEqual(
      response
    );
  });

  it("picks the matching element of a batch", () => {
    const batch = [{ jsonrpc: "2.0", id: "other", result: 1 }, response];
    expect(parseJsonRpcPayload(JSON.stringify(batch), "application/json", "r1")).toEqual(response);
  });

  it("reads the response out of an SSE stream with notifications first", () => {
    const sse = [
      "event: message",
      `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: {} })}`,
      "",
      ": keep-alive",
      "",
      "event: message",
      `data: ${JSON.stringify(response)}`,
      "",
      "",
    ].join("\n");
    expect(parseJsonRpcPayload(sse, "text/event-stream", "r1")).toEqual(response);
  });

  it("joins multi-line data and handles CRLF", () => {
    const sse = `data: {"jsonrpc":"2.0",\r\ndata: "id":"r1","result":{}}\r\n\r\n`;
    expect(parseJsonRpcPayload(sse, "text/event-stream", "r1")).toEqual({
      jsonrpc: "2.0",
      id: "r1",
      result: {},
    });
  });

  it("detects SSE without a content type", () => {
    expect(parseJsonRpcPayload(`data: ${JSON.stringify(response)}\n\n`, null, "r1")).toEqual(
      response
    );
  });

  it("falls back to the last response when no id matches", () => {
    const other = { jsonrpc: "2.0", id: 9, error: { code: -32600, message: "bad" } };
    expect(parseJsonRpcPayload(JSON.stringify(other), "application/json", "r1")).toEqual(other);
  });

  it("returns null when there is no response", () => {
    expect(parseJsonRpcPayload("", "application/json", "r1")).toBeNull();
    expect(parseJsonRpcPayload("not json", "application/json", "r1")).toBeNull();
    expect(
      parseJsonRpcPayload(JSON.stringify({ jsonrpc: "2.0", method: "x" }), "application/json", "r1")
    ).toBeNull();
  });

  it("splits SSE frames", () => {
    expect(sseDataFrames("data: a\n\ndata: b\ndata: c\n\nevent: x\n\n")).toEqual(["a", "b\nc"]);
  });
});

describe("tools", () => {
  const result = {
    tools: [
      {
        name: "read_file",
        description: "Read a file",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: true, title: "Read" },
      },
      { name: "delete_file", annotations: { destructiveHint: true, readOnlyHint: false } },
      { name: "plain" },
      { name: "" },
      { description: "nameless" },
      "junk",
    ],
  };
  const tools = extractTools(result);

  it("keeps named tools only, with their fields", () => {
    expect(tools.map((t) => t.name)).toEqual(["read_file", "delete_file", "plain"]);
    expect(tools[0]).toEqual({
      name: "read_file",
      description: "Read a file",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true, title: "Read" },
    });
    expect(extractTools(null)).toEqual([]);
    expect(extractTools({ tools: "no" })).toEqual([]);
  });

  it("derives badges from explicit hints only", () => {
    expect(toolBadges(tools[0])).toEqual({ readOnly: true, destructive: false });
    expect(toolBadges(tools[1])).toEqual({ readOnly: false, destructive: true });
    expect(toolBadges(tools[2])).toEqual({ readOnly: false, destructive: false });
    // A read-only tool is never treated as destructive.
    expect(
      toolBadges({ name: "x", annotations: { readOnlyHint: true, destructiveHint: true } })
    ).toEqual({ readOnly: true, destructive: false });
  });

  it("asks for confirmation only for destructive tools", () => {
    expect(tools.map(needsConfirmation)).toEqual([false, true, false]);
  });

  it("searches name, title and description", () => {
    expect(searchTools(tools, "READ").map((t) => t.name)).toEqual(["read_file"]);
    expect(searchTools(tools, "a file").map((t) => t.name)).toEqual(["read_file"]);
    expect(searchTools(tools, "  ")).toHaveLength(3);
  });
});

describe("tool results", () => {
  it("detects isError", () => {
    expect(isToolResultError({ isError: true, content: [] })).toBe(true);
    expect(isToolResultError({ content: [] })).toBe(false);
    expect(isToolResultError(null)).toBe(false);
  });

  it("extracts text blocks", () => {
    expect(
      resultTexts({
        content: [
          { type: "text", text: "a" },
          { type: "image", data: "…" },
          { type: "text", text: "b" },
        ],
      })
    ).toEqual(["a", "b"]);
    expect(resultTexts({})).toEqual([]);
  });
});

describe("nextRetryDelayMs", () => {
  it("honours Retry-After within 2–15 s", () => {
    expect(nextRetryDelayMs(3, 0)).toBe(3000);
    expect(nextRetryDelayMs(0, 0)).toBe(2000);
    expect(nextRetryDelayMs(30, 0)).toBe(15_000);
    expect(nextRetryDelayMs(undefined, 0)).toBe(5000);
  });

  it("stops once the two-minute window is spent", () => {
    expect(WAKE_RETRY_WINDOW_MS).toBe(120_000);
    expect(nextRetryDelayMs(5, 114_000)).toBe(5000);
    expect(nextRetryDelayMs(5, 116_000)).toBeNull();
  });
});
