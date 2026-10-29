import { describe, test, expect } from "vitest";
import { drainSseEvents, ensureNewline, killCommand, parseRpcId } from "../commands/connect.js";
import { customizeSkillFilesForAgent, rebrandLegacyCli } from "../setup/templates.js";

describe("killCommand", () => {
  test("Windows kills the whole tree with taskkill", () => {
    expect(killCommand("win32", 4242)).toEqual({
      cmd: "taskkill",
      args: ["/pid", "4242", "/T", "/F"],
    });
  });

  test("POSIX uses a plain signal", () => {
    expect(killCommand("linux", 4242)).toBeNull();
    expect(killCommand("darwin", 4242)).toBeNull();
  });

  test("no pid (spawn failed) → nothing to run", () => {
    expect(killCommand("win32", undefined)).toBeNull();
  });
});

describe("drainSseEvents", () => {
  test("parses complete events and keeps the tail", () => {
    const { events, rest } = drainSseEvents(
      'data: {"type":"ping"}\n\nevent: x\ndata: {"type":"init","server":"s","mcps":[]}\n\ndata: {"ty'
    );
    expect(events).toEqual([{ type: "ping" }, { type: "init", server: "s", mcps: [] }]);
    expect(rest).toBe('data: {"ty');
  });

  test("accepts CRLF line endings", () => {
    const { events, rest } = drainSseEvents(
      'data: {"type":"request","id":"r1","mcpSlug":"blender","body":"{}"}\r\n\r\n'
    );
    expect(events).toEqual([{ type: "request", id: "r1", mcpSlug: "blender", body: "{}" }]);
    expect(rest).toBe("");
  });

  test("skips comments and non-JSON payloads", () => {
    expect(drainSseEvents(": keep-alive\n\ndata: not json\n\n").events).toEqual([]);
  });
});

describe("JSON-RPC helpers", () => {
  test("parseRpcId", () => {
    expect(parseRpcId('{"jsonrpc":"2.0","id":7,"method":"x"}')).toBe(7);
    expect(parseRpcId('[{"id":"a"}]')).toBe("a");
    expect(parseRpcId('{"method":"notifications/initialized"}')).toBeNull();
    expect(parseRpcId("garbage")).toBeNull();
  });

  test("ensureNewline", () => {
    expect(ensureNewline("{}")).toBe("{}\n");
    expect(ensureNewline("{}\n")).toBe("{}\n");
  });
});

describe("rebrandLegacyCli", () => {
  test("points old ctx7 commands at @twinmcp/cli, leaves keys alone", () => {
    const text =
      "Run `npx ctx7@latest library react`, then `ctx7 docs /a/b`. Use the `ctx7` CLI. Key: ctx7sk_abc.";
    expect(rebrandLegacyCli(text)).toBe(
      "Run `npx @twinmcp/cli@latest library react`, then `twinmcp docs /a/b`. Use the `twinmcp` CLI. Key: ctx7sk_abc."
    );
  });

  test("find-docs skill files are rebranded for every agent", () => {
    const files = [{ path: "SKILL.md", content: "npx ctx7@latest docs x" }];
    expect(customizeSkillFilesForAgent("claude", "find-docs", files)[0].content).toBe(
      "npx @twinmcp/cli@latest docs x"
    );
    expect(customizeSkillFilesForAgent("claude", "other-skill", files)).toBe(files);
  });
});
