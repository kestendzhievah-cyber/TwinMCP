import { describe, it, expect } from "vitest";
import {
  CREDIT_DOCS_URL,
  CREDIT_EXHAUSTED_MESSAGE,
  CREDIT_TOPUP_URL,
  PROXY_DOCS_URL,
  PROXY_ERROR,
  PROXY_REQUEST_ID_HEADER,
  jsonRpcErrorBody,
  newProxyRequestId,
  proxyCreditExhausted,
  proxyError,
  proxyRateLimited,
  rateLimited,
  withProxyRequestId,
} from "@/lib/errors";
import { SERVER_SCOPE_MESSAGE } from "@/lib/auth/key-scope";

const RID = "11111111-2222-4333-8444-555555555555";

describe("proxy request id (contract K2)", () => {
  it("uses the header name and docs URL of the contract", () => {
    expect(PROXY_REQUEST_ID_HEADER).toBe("x-twinmcp-request-id");
    expect(PROXY_DOCS_URL).toBe("https://twinmcp.fr/docs#troubleshooting");
  });

  it("mints a fresh UUID per request", () => {
    const a = newProxyRequestId();
    const b = newProxyRequestId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it("withProxyRequestId stamps any response, bodiless ones included", () => {
    const res = withProxyRequestId(new Response(null, { status: 405 }), RID);
    expect(res.headers.get(PROXY_REQUEST_ID_HEADER)).toBe(RID);
    expect(res.status).toBe(405);
  });
});

describe("jsonRpcErrorBody", () => {
  it("carries { requestId, docsUrl } in error.data", () => {
    expect(jsonRpcErrorBody(7, -32001, "waking", RID)).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32001, message: "waking", data: { requestId: RID, docsUrl: PROXY_DOCS_URL } },
    });
  });

  it("extra data overrides docsUrl and adds fields, requestId stays", () => {
    expect(
      jsonRpcErrorBody(1, -32008, "m", RID, { docsUrl: CREDIT_DOCS_URL, topupUrl: "t" }).error.data
    ).toEqual({ requestId: RID, docsUrl: CREDIT_DOCS_URL, topupUrl: "t" });
  });

  it("keeps string ids and turns anything else into null", () => {
    expect(jsonRpcErrorBody("abc", 1, "m", RID).id).toBe("abc");
    expect(jsonRpcErrorBody(undefined, 1, "m", RID).id).toBeNull();
    expect(jsonRpcErrorBody({ x: 1 }, 1, "m", RID).id).toBeNull();
    expect(jsonRpcErrorBody(null, 1, "m", RID).id).toBeNull();
  });
});

describe("proxyError", () => {
  it("non-2xx: JSON-RPC envelope + top-level message, header set, status kept", async () => {
    const res = proxyError({
      status: 503,
      code: PROXY_ERROR.UNAVAILABLE,
      message: "MCP server is waking up from idle. Retry in a few seconds.",
      requestId: RID,
      rpcId: 3,
      headers: { "retry-after": "3" },
    });
    expect(res.status).toBe(503);
    expect(res.headers.get(PROXY_REQUEST_ID_HEADER)).toBe(RID);
    expect(res.headers.get("retry-after")).toBe("3");
    const body = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(3);
    expect(body.error.code).toBe(-32001);
    expect(body.error.data).toEqual({ requestId: RID, docsUrl: PROXY_DOCS_URL });
    // Plain JSON callers and the dashboard connection test read `message`.
    expect(body.message).toBe(body.error.message);
  });

  it("200: a strict JSON-RPC error, no extra top-level fields", async () => {
    const res = proxyError({
      status: 200,
      code: PROXY_ERROR.METHOD_NOT_FOUND,
      message: "Unknown tool: x",
      requestId: RID,
      rpcId: 1,
      extra: { ignored: true },
    });
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["error", "id", "jsonrpc"]);
    expect(body.error.data.requestId).toBe(RID);
  });

  it("403 key restriction: code -32003 and the contract message", async () => {
    const res = proxyError({
      status: 403,
      code: PROXY_ERROR.KEY_RESTRICTED,
      message: SERVER_SCOPE_MESSAGE,
      requestId: RID,
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatchObject({
      code: -32003,
      message: "This API key is restricted to another server.",
    });
  });

  it("keeps a WWW-Authenticate header on a 401", () => {
    const res = proxyError({
      status: 401,
      code: PROXY_ERROR.UNAUTHORIZED,
      message: "Invalid API key.",
      requestId: RID,
      headers: { "WWW-Authenticate": 'Bearer realm="twinmcp"' },
    });
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(res.headers.get(PROXY_REQUEST_ID_HEADER)).toBe(RID);
  });
});

describe("proxyRateLimited (per-minute abuse limiter)", () => {
  const info = {
    limit: 600,
    remaining: 0,
    reset: Date.now() + 30_000,
    window: "minute" as const,
  };

  it("same text, headers and window fields as rateLimited(), plus the JSON-RPC envelope", async () => {
    const plain = rateLimited(true, info);
    const proxied = proxyRateLimited(RID, 9, true, info);
    expect(proxied.status).toBe(429);
    for (const h of ["Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"]) {
      expect(proxied.headers.get(h)).toBe(plain.headers.get(h));
    }
    expect(proxied.headers.get(PROXY_REQUEST_ID_HEADER)).toBe(RID);
    const a = await plain.json();
    const b = await proxied.json();
    expect(b.message).toBe(a.message);
    expect(b.message).toContain("600 tool calls per minute");
    expect(b.limit).toBe(a.limit);
    expect(b.window).toBe("minute");
    expect(b.upgradeUrl).toBeUndefined();
    expect(b.error).toMatchObject({ code: PROXY_ERROR.RATE_LIMITED, message: a.message });
    expect(b.error.code).toBe(-32029);
    expect(b.error.data).toEqual({ requestId: RID, docsUrl: PROXY_DOCS_URL });
    expect(b.id).toBe(9);
  });

  it("generic 429 (no window details) still works", async () => {
    const res = proxyRateLimited(RID, null, true);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toMatch(/^Rate limited\./);
  });
});

describe("proxyCreditExhausted (contract W2)", () => {
  it("402, code -32008, the contract message and { requestId, docsUrl, topupUrl }", async () => {
    const res = proxyCreditExhausted(RID, 12);
    expect(res.status).toBe(402);
    expect(res.headers.get(PROXY_REQUEST_ID_HEADER)).toBe(RID);
    const body = await res.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 12,
      error: {
        code: -32008,
        message: "Your TwinMCP credit is used up. Top up at https://twinmcp.fr/dashboard/billing",
        data: {
          requestId: RID,
          docsUrl: "https://twinmcp.fr/docs#credit",
          topupUrl: "https://twinmcp.fr/dashboard/billing",
        },
      },
      // Plain JSON callers read the top-level fields.
      message: CREDIT_EXHAUSTED_MESSAGE,
      topupUrl: CREDIT_TOPUP_URL,
    });
    expect(PROXY_ERROR.CREDIT_EXHAUSTED).toBe(-32008);
  });

  it("echoes a string id and nulls a missing one", async () => {
    expect((await proxyCreditExhausted(RID, "a").json()).id).toBe("a");
    expect((await proxyCreditExhausted(RID, undefined).json()).id).toBeNull();
  });
});
