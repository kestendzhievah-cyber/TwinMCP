import { describe, test, expect } from "vitest";
import {
  ApiError,
  HostingClient,
  buildServerUrl,
  coerceConfig,
  describeApiError,
  findServer,
  formatTable,
  isApiKey,
  isValidSlug,
  maskKey,
  parseConfigPairs,
  resolveApiKey,
  serverEntryLabel,
  type HostedServer,
} from "../utils/hosting.js";

const KEY = "ctx7sk_full_0123456789abcdef";

describe("buildServerUrl", () => {
  test("whole-server URL", () => {
    expect(buildServerUrl("https://twinmcp.fr", "my-tools")).toBe(
      "https://twinmcp.fr/api/mcp/my-tools"
    );
  });

  test("router mode adds ?mode=router", () => {
    expect(buildServerUrl("https://twinmcp.fr", "my-tools", { router: true })).toBe(
      "https://twinmcp.fr/api/mcp/my-tools?mode=router"
    );
  });

  test("per-MCP URL", () => {
    expect(buildServerUrl("https://twinmcp.fr", "my-tools", { mcp: "brave-search" })).toBe(
      "https://twinmcp.fr/api/mcp/my-tools/brave-search"
    );
  });

  test("trailing slashes on the base are dropped", () => {
    expect(buildServerUrl("http://localhost:3000///", "dev")).toBe(
      "http://localhost:3000/api/mcp/dev"
    );
  });

  test("router and mcp together is an error", () => {
    expect(() => buildServerUrl("https://twinmcp.fr", "a", { mcp: "b", router: true })).toThrow(
      /--router/
    );
  });

  test("entry label matches the dashboard's", () => {
    expect(serverEntryLabel("my-tools")).toBe("twinmcp-my-tools");
  });
});

describe("slugs and keys", () => {
  test.each([
    ["my-tools", true],
    ["a1", true],
    ["a", false],
    ["My-Tools", false],
    ["-lead", false],
    ["trail-", false],
    ["has space", false],
    ["x".repeat(65), false],
  ])("isValidSlug(%s) = %s", (slug, ok) => {
    expect(isValidSlug(slug)).toBe(ok);
  });

  test("isApiKey only accepts ctx7sk_ keys", () => {
    expect(isApiKey(KEY)).toBe(true);
    expect(isApiKey("ctx7sk_")).toBe(false);
    expect(isApiKey("tmcp_at_abcdefghijklmnop")).toBe(false);
    expect(isApiKey(undefined)).toBe(false);
  });

  test("maskKey never prints the whole key", () => {
    expect(maskKey(KEY)).toBe("ctx7sk_full…cdef");
    expect(maskKey("ctx7sk_short")).toBe("ctx7sk_…");
  });
});

describe("resolveApiKey", () => {
  test("flag wins over env and stored", () => {
    expect(resolveApiKey({ flag: KEY, env: "ctx7sk_env_key_123456", stored: null })).toEqual({
      key: KEY,
      source: "flag",
    });
  });

  test("a flag that is not a key is an error", () => {
    expect(() => resolveApiKey({ flag: "oops" })).toThrow(/ctx7sk_/);
  });

  test("env before stored", () => {
    expect(resolveApiKey({ env: KEY, stored: "ctx7sk_stored_123456789" })?.source).toBe("env");
  });

  test("a stored OAuth token is skipped", () => {
    expect(resolveApiKey({ stored: "some-oauth-access-token" })).toBeNull();
    expect(resolveApiKey({ stored: KEY })).toEqual({ key: KEY, source: "stored" });
  });
});

describe("parseConfigPairs", () => {
  test("splits on the first = only", () => {
    expect(parseConfigPairs(["A=1", "URL=postgres://u:p@h/db?x=y"])).toEqual({
      A: "1",
      URL: "postgres://u:p@h/db?x=y",
    });
  });

  test("empty value is allowed, last duplicate wins", () => {
    expect(parseConfigPairs(["A=", "A=2"])).toEqual({ A: "2" });
  });

  test("undefined → {}", () => {
    expect(parseConfigPairs(undefined)).toEqual({});
  });

  test.each(["NOEQUALS", "=value"])("rejects %s", (pair) => {
    expect(() => parseConfigPairs([pair])).toThrow(/KEY=VALUE/);
  });
});

describe("coerceConfig", () => {
  const schema = {
    properties: {
      TOKEN: { type: "string" as const, required: true, secret: true },
      PORT: { type: "number" as const },
      READ_ONLY: { type: "boolean" as const },
    },
  };

  test("converts numbers and booleans to the declared types", () => {
    const r = coerceConfig({ TOKEN: "t", PORT: "8080", READ_ONLY: "yes" }, schema);
    expect(r.config).toEqual({ TOKEN: "t", PORT: 8080, READ_ONLY: true });
    expect(r.errors).toEqual([]);
  });

  test("reports bad types and missing required keys together", () => {
    const r = coerceConfig({ PORT: "eighty", READ_ONLY: "maybe" }, schema);
    expect(r.errors).toEqual([
      "PORT must be a number",
      "READ_ONLY must be true or false",
      "missing required config TOKEN",
    ]);
  });

  test("an empty required value counts as missing", () => {
    expect(coerceConfig({ TOKEN: "" }, schema).errors).toEqual(["missing required config TOKEN"]);
  });

  test("keys outside the schema are kept and listed", () => {
    const r = coerceConfig({ TOKEN: "t", EXTRA: "x" }, schema);
    expect(r.config.EXTRA).toBe("x");
    expect(r.unknown).toEqual(["EXTRA"]);
  });

  test("no schema → strings pass through", () => {
    expect(coerceConfig({ A: "1" }, null)).toEqual({
      config: { A: "1" },
      errors: [],
      unknown: ["A"],
    });
  });
});

describe("describeApiError", () => {
  test("401 points at login", () => {
    expect(describeApiError(401, { message: "Sign in required" })).toMatch(/twinmcp login --key/);
  });

  test("403 key_scope explains the mcp_proxy scope", () => {
    expect(describeApiError(403, { message: "x", code: "key_scope" })).toMatch(
      /scope mcp_proxy.*full-access key/
    );
  });

  test("other 403s keep the API's message (plan limits)", () => {
    expect(describeApiError(403, { message: "The large box size requires the Pro plan." })).toBe(
      "The large box size requires the Pro plan."
    );
  });

  test("429 adds Retry-After", () => {
    expect(describeApiError(429, { message: "Too many API-key operations." }, "12")).toBe(
      "Too many API-key operations. Retry in 12s."
    );
    expect(describeApiError(429, null)).toBe("Too many requests.");
  });

  test("5xx without a body", () => {
    expect(describeApiError(502, null)).toMatch(/HTTP 502/);
  });
});

describe("findServer / formatTable", () => {
  const servers = [
    { id: "id-1", slug: "alpha" },
    { id: "alpha-id", slug: "beta" },
  ] as HostedServer[];

  test("slug match is preferred over id match", () => {
    expect(findServer(servers, "alpha")?.id).toBe("id-1");
    expect(findServer(servers, "alpha-id")?.slug).toBe("beta");
    expect(findServer(servers, "nope")).toBeUndefined();
  });

  test("columns are padded, last column is not", () => {
    expect(formatTable(["A", "BB"], [["xxx", "y"]])).toBe("A    BB\nxxx  y");
  });
});

type Call = { url: string; init: RequestInit };

function fakeFetch(
  routes: Record<string, { status?: number; body: unknown; headers?: Record<string, string> }>
) {
  const calls: Call[] = [];
  const impl = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    const route = routes[key];
    if (!route) throw new Error(`unexpected ${key}`);
    const status = route.status ?? 200;
    return new Response(JSON.stringify(route.body), { status, headers: route.headers });
  };
  return { impl, calls };
}

describe("HostingClient", () => {
  const server: HostedServer = {
    id: "srv-1",
    name: "My tools",
    slug: "my-tools",
    hostType: "upstash_box",
    boxSize: "small",
    region: null,
    endpointUrl: null,
    status: "running",
    lastHeartbeatAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  test("sends the Bearer key and resolves a slug to the server", async () => {
    const { impl, calls } = fakeFetch({ "GET /api/v2/servers": { body: { items: [server] } } });
    const client = new HostingClient("https://twinmcp.fr/", KEY, impl);
    await expect(client.getServer("my-tools")).resolves.toEqual(server);
    expect(calls[0].url).toBe("https://twinmcp.fr/api/v2/servers");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  test("unknown server → 404 ApiError with a hint", async () => {
    const { impl } = fakeFetch({ "GET /api/v2/servers": { body: { items: [] } } });
    const err = await new HostingClient("https://twinmcp.fr", KEY, impl)
      .getServer("ghost")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toMatch(/twinmcp servers list/);
  });

  test("createServer posts the exact body", async () => {
    const { impl, calls } = fakeFetch({
      "POST /api/v2/servers": {
        status: 201,
        body: { id: "srv-2", slug: "new", status: "provisioning" },
      },
    });
    const res = await new HostingClient("https://twinmcp.fr", KEY, impl).createServer({
      name: "New",
      boxSize: "small",
    });
    expect(res).toEqual({ id: "srv-2", slug: "new", status: "provisioning" });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: "New", boxSize: "small" });
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
  });

  test("installMcp posts { mcpServerId, config } to the server's mcps", async () => {
    const { impl, calls } = fakeFetch({
      "POST /api/v2/servers/srv-1/mcps": {
        status: 201,
        body: { id: "us-1", mcpServerId: "cat-9" },
      },
    });
    await new HostingClient("https://twinmcp.fr", KEY, impl).installMcp("srv-1", "cat-9", {
      PORT: 1,
    });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      mcpServerId: "cat-9",
      config: { PORT: 1 },
    });
  });

  test("createProxyKey asks for an mcp_proxy key bound to the server", async () => {
    const { impl, calls } = fakeFetch({
      "POST /api/v2/auth/keys": {
        status: 201,
        body: { id: "k1", key: "ctx7sk_bound", scope: "mcp_proxy", serverId: "srv-1" },
      },
    });
    const created = await new HostingClient("https://twinmcp.fr", KEY, impl).createProxyKey(
      "srv-1",
      "x".repeat(100)
    );
    expect(created.key).toBe("ctx7sk_bound");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toEqual({ name: "x".repeat(80), scope: "mcp_proxy", serverId: "srv-1" });
  });

  test("searchCatalog passes q and limit", async () => {
    const { impl, calls } = fakeFetch({ "GET /api/v2/mcp-servers": { body: { items: [] } } });
    await new HostingClient("https://twinmcp.fr", KEY, impl).searchCatalog("brave");
    expect(new URL(calls[0].url).searchParams.get("q")).toBe("brave");
    expect(new URL(calls[0].url).searchParams.get("limit")).toBe("50");
  });

  test("a 429 surfaces the message and Retry-After", async () => {
    const { impl } = fakeFetch({
      "POST /api/v2/auth/keys": {
        status: 429,
        body: { message: "Too many API-key operations. Please wait a moment and try again." },
        headers: { "Retry-After": "30" },
      },
    });
    const err = (await new HostingClient("https://twinmcp.fr", KEY, impl)
      .createProxyKey("srv-1", "n")
      .catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/Retry in 30s/);
  });

  test("a 403 key_scope keeps its code", async () => {
    const { impl } = fakeFetch({
      "GET /api/v2/servers": { status: 403, body: { message: "m", code: "key_scope" } },
    });
    const err = (await new HostingClient("https://twinmcp.fr", KEY, impl)
      .listServers()
      .catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe("key_scope");
    expect(err.message).toMatch(/mcp_proxy/);
  });

  test("network failure → readable ApiError", async () => {
    const client = new HostingClient("https://twinmcp.fr", KEY, async () => {
      throw new Error("ENOTFOUND");
    });
    await expect(client.listServers()).rejects.toThrow(/Could not reach https:\/\/twinmcp.fr/);
  });
});
