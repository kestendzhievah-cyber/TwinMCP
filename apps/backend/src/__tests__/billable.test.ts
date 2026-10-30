import { describe, it, expect } from "vitest";
import { BILLABLE_RPC_METHOD, isBillableRequest } from "@/lib/mcp/billable";

const rpc = (method: string, id?: string | number | null, params?: unknown) =>
  JSON.stringify({ jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, params });

const toolsCall = (id: string | number = 1) =>
  rpc(BILLABLE_RPC_METHOD, id, { name: "fetch", arguments: { url: "https://example.com" } });

describe("isBillableRequest — single JSON-RPC requests", () => {
  it("bills a POST tools/call and echoes its method and id", () => {
    expect(isBillableRequest("POST", toolsCall(7))).toMatchObject({
      billable: true,
      units: 1,
      rpcMethod: "tools/call",
      rpcId: 7,
    });
  });

  it("keeps a string id", () => {
    expect(isBillableRequest("POST", toolsCall("req-1")).rpcId).toBe("req-1");
  });

  it("accepts the HTTP method in any case", () => {
    expect(isBillableRequest("post", toolsCall()).billable).toBe(true);
    expect(isBillableRequest("Post", toolsCall()).billable).toBe(true);
  });

  it.each([
    "initialize",
    "tools/list",
    "ping",
    "resources/list",
    "prompts/list",
    "completion/complete",
  ])("does not bill protocol overhead: %s", (method) => {
    const v = isBillableRequest("POST", rpc(method, 1));
    expect(v.billable).toBe(false);
    expect(v.rpcMethod).toBe(method);
    expect(v.rpcId).toBe(1);
  });

  it("does not bill notifications (no id) and reports a null id", () => {
    const v = isBillableRequest("POST", rpc("notifications/initialized"));
    expect(v).toMatchObject({
      billable: false,
      units: 0,
      rpcMethod: "notifications/initialized",
      rpcId: null,
    });
  });

  it("does not bill a JSON-RPC response or a message without a method", () => {
    expect(
      isBillableRequest("POST", JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }))
    ).toMatchObject({
      billable: false,
      units: 0,
      rpcMethod: null,
      rpcId: 1,
    });
    expect(isBillableRequest("POST", JSON.stringify({ jsonrpc: "2.0", id: 1 })).billable).toBe(
      false
    );
  });

  it("is exact about the method name", () => {
    expect(isBillableRequest("POST", rpc("tools/call/", 1)).billable).toBe(false);
    expect(isBillableRequest("POST", rpc("Tools/Call", 1)).billable).toBe(false);
    expect(isBillableRequest("POST", rpc(" tools/call", 1)).billable).toBe(false);
  });

  it("normalises an unusual id to null rather than echoing it", () => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: { nested: true }, method: "tools/call" });
    const v = isBillableRequest("POST", body);
    expect(v.billable).toBe(true);
    expect(v.rpcId).toBeNull();
    expect(
      isBillableRequest("POST", JSON.stringify({ id: null, method: "tools/call" })).rpcId
    ).toBeNull();
    expect(
      isBillableRequest("POST", JSON.stringify({ id: true, method: "tools/call" })).rpcId
    ).toBeNull();
  });

  it("ignores a non-string method", () => {
    const v = isBillableRequest("POST", JSON.stringify({ jsonrpc: "2.0", id: 1, method: 42 }));
    expect(v).toMatchObject({ billable: false, units: 0, rpcMethod: null, rpcId: 1 });
  });
});

describe("isBillableRequest — HTTP methods without a billable body", () => {
  it.each(["GET", "DELETE", "PUT", "PATCH", "OPTIONS", "HEAD"])(
    "never bills %s, even with a tools/call body",
    (method) => {
      expect(isBillableRequest(method, toolsCall())).toMatchObject({
        billable: false,
        units: 0,
        rpcMethod: null,
        rpcId: null,
      });
      expect(isBillableRequest(method, null).billable).toBe(false);
    }
  );
});

describe("isBillableRequest — malformed or empty bodies", () => {
  it.each([null, undefined, "", "   ", "\n"])("treats %j as not billable", (body) => {
    expect(isBillableRequest("POST", body)).toMatchObject({
      billable: false,
      units: 0,
      rpcMethod: null,
      rpcId: null,
    });
  });

  it.each(["{not json", '{"method": "tools/call"', "tools/call", "<xml/>", "{]"])(
    "treats invalid JSON %j as not billable",
    (body) => {
      expect(isBillableRequest("POST", body)).toMatchObject({
        billable: false,
        units: 0,
        rpcMethod: null,
        rpcId: null,
      });
    }
  );

  it.each(['"tools/call"', "42", "null", "true"])(
    "treats a JSON scalar %s as not billable",
    (body) => {
      expect(isBillableRequest("POST", body).billable).toBe(false);
      expect(isBillableRequest("POST", body).rpcMethod).toBeNull();
    }
  );

  it("tolerates surrounding whitespace around valid JSON", () => {
    expect(isBillableRequest("POST", `\n  ${toolsCall(3)}  \n`)).toMatchObject({
      billable: true,
      units: 1,
      rpcMethod: "tools/call",
      rpcId: 3,
    });
  });
});

describe("isBillableRequest — JSON-RPC batches", () => {
  it("bills a batch when any element is a tools/call and reports that element", () => {
    const batch = `[${rpc("ping", 1)}, ${toolsCall(2)}, ${rpc("tools/list", 3)}]`;
    expect(isBillableRequest("POST", batch)).toMatchObject({
      billable: true,
      units: 1,
      rpcMethod: "tools/call",
      rpcId: 2,
    });
  });

  it("reports the first tools/call when a batch holds several", () => {
    const batch = `[${toolsCall("a")}, ${toolsCall("b")}]`;
    expect(isBillableRequest("POST", batch).rpcId).toBe("a");
  });

  it("counts every tools/call in a batch as a unit (the proxy refuses units > 1)", () => {
    const batch = `[${toolsCall("a")}, ${rpc("ping", 2)}, ${toolsCall("b")}, ${toolsCall("c")}]`;
    const v = isBillableRequest("POST", batch);
    expect(v.billable).toBe(true);
    expect(v.units).toBe(3);
  });

  it("counts a single tools/call as one unit and overhead as zero", () => {
    expect(isBillableRequest("POST", toolsCall()).units).toBe(1);
    expect(isBillableRequest("POST", rpc("tools/list", 1)).units).toBe(0);
    expect(isBillableRequest("GET", toolsCall()).units).toBe(0);
  });

  it("does not bill a batch of overhead and reports its first element", () => {
    const batch = `[${rpc("initialize", 9)}, ${rpc("notifications/initialized")}]`;
    expect(isBillableRequest("POST", batch)).toMatchObject({
      billable: false,
      units: 0,
      rpcMethod: "initialize",
      rpcId: 9,
    });
  });

  it("treats an empty batch as not billable", () => {
    expect(isBillableRequest("POST", "[]")).toMatchObject({
      billable: false,
      units: 0,
      rpcMethod: null,
      rpcId: null,
    });
  });

  it("skips non-object elements and still finds the tools/call", () => {
    const batch = `[42, "x", null, ${toolsCall(5)}]`;
    expect(isBillableRequest("POST", batch)).toMatchObject({
      billable: true,
      units: 1,
      rpcMethod: "tools/call",
      rpcId: 5,
    });
  });

  it("reports nulls for a batch made only of non-objects", () => {
    expect(isBillableRequest("POST", "[1, 2, 3]")).toMatchObject({
      billable: false,
      units: 0,
      rpcMethod: null,
      rpcId: null,
    });
  });
});

describe("isBillableRequest — needsCredit (work that is not charged as a tool call)", () => {
  it.each(["resources/read", "prompts/get", "completion/complete", "sampling/createMessage"])(
    "%s needs credit but is not billed",
    (method) => {
      const v = isBillableRequest("POST", rpc(method, 1));
      expect(v.billable).toBe(false);
      expect(v.needsCredit).toBe(true);
    }
  );

  it.each([
    "initialize",
    "ping",
    "tools/list",
    "resources/list",
    "resources/templates/list",
    "prompts/list",
    "logging/setLevel",
    "notifications/initialized",
    "notifications/cancelled",
  ])("%s stays free of any wallet check", (method) => {
    expect(isBillableRequest("POST", rpc(method, 1)).needsCredit).toBe(false);
  });

  it("a tools/call needs credit; GET, responses and garbage do not", () => {
    expect(isBillableRequest("POST", toolsCall()).needsCredit).toBe(true);
    expect(isBillableRequest("GET", rpc("resources/read", 1)).needsCredit).toBe(false);
    expect(
      isBillableRequest("POST", JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })).needsCredit
    ).toBe(false);
    expect(isBillableRequest("POST", "{not json").needsCredit).toBe(false);
  });

  it("a batch needs credit when any element does", () => {
    const batch = JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "file:///x" } },
    ]);
    expect(isBillableRequest("POST", batch)).toMatchObject({ billable: false, needsCredit: true });
  });
});
