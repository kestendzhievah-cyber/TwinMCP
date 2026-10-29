import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("../utils/tracking.js", () => ({ trackEvent: vi.fn() }));
vi.mock("ora", () => {
  const spinner = {
    start: () => spinner,
    stop: () => spinner,
    succeed: () => spinner,
    fail: () => spinner,
    text: "",
  };
  return { default: () => spinner };
});
const mockLoadTokens = vi.fn((): { access_token: string } | null => null);
vi.mock("../utils/auth.js", async (orig) => ({
  ...(await orig<typeof import("../utils/auth.js")>()),
  loadTokens: () => mockLoadTokens(),
}));

import { registerHostingCommands } from "../commands/hosting.js";
import { registerSetupCommand } from "../commands/setup.js";
import { setBaseUrl } from "../utils/api.js";

const FULL_KEY = "ctx7sk_full_0123456789abcdef";
const BOUND_KEY = "ctx7sk_bound_abcdef0123456789";

const SERVER = {
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

type Route = { status?: number; body: unknown };
let calls: Array<{ method: string; path: string; body: unknown; auth: string | undefined }>;
let out: string[];
let err: string[];

function routeFetch(routes: Record<string, Route>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({
        method,
        path: u.pathname + u.search,
        body: init.body ? JSON.parse(init.body as string) : undefined,
        auth: headers.Authorization,
      });
      const route = routes[`${method} ${u.pathname}`];
      if (!route) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
    })
  );
}

async function run(register: (p: Command) => void, ...args: string[]) {
  const program = new Command();
  program.exitOverride();
  register(program);
  await program.parseAsync(["node", "twinmcp", ...args]);
}

beforeEach(() => {
  calls = [];
  out = [];
  err = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void err.push(a.join(" ")));
  process.env.TWINMCP_API_KEY = FULL_KEY;
  process.exitCode = undefined;
  setBaseUrl("https://twinmcp.fr");
  mockLoadTokens.mockReturnValue(null);
});

afterEach(() => {
  delete process.env.TWINMCP_API_KEY;
  process.exitCode = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("twinmcp url", () => {
  test("prints the whole-server URL without calling the API", async () => {
    routeFetch({});
    await run(registerHostingCommands, "url", "my-tools");
    expect(out).toEqual(["https://twinmcp.fr/api/mcp/my-tools"]);
    expect(calls).toHaveLength(0);
  });

  test("--router and --mcp", async () => {
    routeFetch({});
    await run(registerHostingCommands, "url", "my-tools", "--router");
    await run(registerHostingCommands, "url", "my-tools", "--mcp", "fetch");
    expect(out).toEqual([
      "https://twinmcp.fr/api/mcp/my-tools?mode=router",
      "https://twinmcp.fr/api/mcp/my-tools/fetch",
    ]);
  });

  test("honours --base-url (via setBaseUrl)", async () => {
    setBaseUrl("http://localhost:3000");
    routeFetch({});
    await run(registerHostingCommands, "url", "dev");
    expect(out).toEqual(["http://localhost:3000/api/mcp/dev"]);
  });

  test("rejects a non-slug and router+mcp", async () => {
    routeFetch({});
    await run(registerHostingCommands, "url", "Not A Slug");
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    await run(registerHostingCommands, "url", "a1", "--mcp", "b1", "--router");
    expect(process.exitCode).toBe(1);
  });
});

describe("twinmcp servers", () => {
  test("list prints a table with each server's URL", async () => {
    routeFetch({ "GET /api/v2/servers": { body: { items: [SERVER] } } });
    await run(registerHostingCommands, "servers", "list");
    expect(calls[0].auth).toBe(`Bearer ${FULL_KEY}`);
    const lines = out.join("\n").split("\n");
    expect(lines[0]).toMatch(/^SLUG\s+NAME\s+STATUS\s+HOST\s+URL$/);
    expect(lines[1]).toMatch(
      /^my-tools\s+My tools\s+running\s+small\s+https:\/\/twinmcp\.fr\/api\/mcp\/my-tools$/
    );
  });

  test("create sends name + size", async () => {
    routeFetch({
      "POST /api/v2/servers": {
        status: 201,
        body: { id: "srv-2", slug: "new-one", status: "provisioning" },
      },
    });
    await run(registerHostingCommands, "servers", "create", "New one", "--size", "small");
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/api/v2/servers",
      body: { name: "New one", boxSize: "small" },
    });
  });

  test("create --local sends hostType local_agent and no size", async () => {
    routeFetch({
      "POST /api/v2/servers": { status: 201, body: { id: "s", slug: "desk", status: "stopped" } },
    });
    await run(registerHostingCommands, "servers", "create", "Desk", "--local");
    expect(calls[0].body).toEqual({ name: "Desk", hostType: "local_agent" });
  });

  test("create rejects an unknown size before calling the API", async () => {
    routeFetch({});
    await run(registerHostingCommands, "servers", "create", "X", "--size", "huge");
    expect(calls).toHaveLength(0);
    expect(process.exitCode).toBe(1);
  });

  test("a mcp_proxy key gets the scope explanation", async () => {
    routeFetch({
      "GET /api/v2/servers": { status: 403, body: { message: "m", code: "key_scope" } },
    });
    await run(registerHostingCommands, "servers", "list");
    expect(process.exitCode).toBe(1);
    expect(out.join("\n")).toMatch(/scope mcp_proxy/);
  });

  test("no key anywhere → guidance, no request", async () => {
    delete process.env.TWINMCP_API_KEY;
    routeFetch({});
    await run(registerHostingCommands, "servers", "list");
    expect(calls).toHaveLength(0);
    expect(out.join("\n")).toMatch(/twinmcp login --key/);
  });

  test("falls back to the key stored by `twinmcp login`", async () => {
    delete process.env.TWINMCP_API_KEY;
    mockLoadTokens.mockReturnValue({ access_token: FULL_KEY });
    routeFetch({ "GET /api/v2/servers": { body: { items: [] } } });
    await run(registerHostingCommands, "servers", "list");
    expect(calls[0].auth).toBe(`Bearer ${FULL_KEY}`);
  });
});

describe("twinmcp mcp", () => {
  test("install resolves the server and catalog ids and coerces config", async () => {
    routeFetch({
      "GET /api/v2/servers": { body: { items: [SERVER] } },
      "GET /api/v2/mcp-servers/postgres": {
        body: {
          id: "cat-pg",
          slug: "postgres",
          name: "PostgreSQL",
          configSchema: {
            properties: {
              DATABASE_URL: { type: "string", required: true, secret: true },
              MAX_ROWS: { type: "number" },
            },
          },
        },
      },
      "POST /api/v2/servers/srv-1/mcps": {
        status: 201,
        body: { id: "us-1", mcpServerId: "cat-pg" },
      },
    });
    await run(
      registerHostingCommands,
      "mcp",
      "install",
      "my-tools",
      "postgres",
      "--yes",
      "--config",
      "DATABASE_URL=postgres://u:p@h/db?sslmode=require",
      "MAX_ROWS=50"
    );
    const post = calls.find((c) => c.method === "POST");
    expect(post).toMatchObject({
      path: "/api/v2/servers/srv-1/mcps",
      body: {
        mcpServerId: "cat-pg",
        config: { DATABASE_URL: "postgres://u:p@h/db?sslmode=require", MAX_ROWS: 50 },
      },
    });
    expect(process.exitCode).toBeUndefined();
  });

  test("install with a missing required key fails before the POST and lists the keys", async () => {
    routeFetch({
      "GET /api/v2/servers": { body: { items: [SERVER] } },
      "GET /api/v2/mcp-servers/brave-search": {
        body: {
          id: "cat-b",
          slug: "brave-search",
          name: "Brave Search",
          configSchema: {
            properties: { BRAVE_API_KEY: { type: "string", required: true, secret: true } },
          },
        },
      },
    });
    await run(registerHostingCommands, "mcp", "install", "my-tools", "brave-search", "--yes");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(process.exitCode).toBe(1);
    expect(out.join("\n")).toMatch(/missing required config BRAVE_API_KEY/);
    expect(out.join("\n")).toMatch(/BRAVE_API_KEY {2}\(string, required, secret\)/);
  });

  test("list shows each installed MCP with its URL", async () => {
    routeFetch({
      "GET /api/v2/servers": { body: { items: [SERVER] } },
      "GET /api/v2/servers/srv-1/mcps": {
        body: {
          items: [
            {
              id: "us-1",
              mcpServerId: "c",
              enabled: true,
              installedAt: "",
              mcpSlug: "fetch",
              mcpName: "Fetch",
              mcpRuntime: "python",
              mcpVersion: "1",
            },
          ],
        },
      },
    });
    await run(registerHostingCommands, "mcp", "list", "my-tools");
    expect(out.join("\n")).toContain("https://twinmcp.fr/api/mcp/my-tools/fetch");
  });
});

describe("twinmcp setup --server", () => {
  let dir: string;
  let cwd: string;

  beforeEach(async () => {
    cwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), "twinmcp-setup-"));
    process.chdir(dir);
  });

  afterEach(async () => {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  });

  test("mints a server-bound key and writes the server URL into the client config", async () => {
    routeFetch({
      "GET /api/v2/servers": { body: { items: [SERVER] } },
      "POST /api/v2/auth/keys": {
        status: 201,
        body: { id: "k1", key: BOUND_KEY, scope: "mcp_proxy", serverId: "srv-1" },
      },
    });
    await run(
      registerSetupCommand,
      "setup",
      "--server",
      "my-tools",
      "--cursor",
      "--codex",
      "--project",
      "--yes"
    );

    const keyCall = calls.find((c) => c.path === "/api/v2/auth/keys");
    expect(keyCall).toMatchObject({
      method: "POST",
      auth: `Bearer ${FULL_KEY}`,
      body: { scope: "mcp_proxy", serverId: "srv-1", name: "CLI setup (Cursor, Codex)" },
    });

    const cursor = JSON.parse(await readFile(join(dir, ".cursor", "mcp.json"), "utf-8"));
    expect(cursor.mcpServers["twinmcp-my-tools"]).toEqual({
      url: "https://twinmcp.fr/api/mcp/my-tools",
      headers: { Authorization: `Bearer ${BOUND_KEY}` },
    });

    const codex = await readFile(join(dir, ".codex", "config.toml"), "utf-8");
    expect(codex).toContain("[mcp_servers.twinmcp-my-tools]");
    expect(codex).toContain('url = "https://twinmcp.fr/api/mcp/my-tools"');
    expect(codex).toContain(`Authorization = "Bearer ${BOUND_KEY}"`);
    // the account-wide key never lands in a config file
    expect(JSON.stringify(cursor) + codex).not.toContain(FULL_KEY);
  });

  test("--router writes the router URL", async () => {
    routeFetch({
      "GET /api/v2/servers": { body: { items: [SERVER] } },
      "POST /api/v2/auth/keys": { status: 201, body: { id: "k1", key: BOUND_KEY } },
    });
    await run(
      registerSetupCommand,
      "setup",
      "--server",
      "my-tools",
      "--claude",
      "--project",
      "--router"
    );
    const claude = JSON.parse(await readFile(join(dir, ".mcp.json"), "utf-8"));
    expect(claude.mcpServers["twinmcp-my-tools"]).toEqual({
      type: "http",
      url: "https://twinmcp.fr/api/mcp/my-tools?mode=router",
      headers: { Authorization: `Bearer ${BOUND_KEY}` },
    });
  });

  test("--oauth with a slug needs no API call and writes no header", async () => {
    delete process.env.TWINMCP_API_KEY;
    routeFetch({});
    await run(
      registerSetupCommand,
      "setup",
      "--server",
      "my-tools",
      "--gemini",
      "--project",
      "--oauth"
    );
    expect(calls).toHaveLength(0);
    const gemini = JSON.parse(await readFile(join(dir, ".gemini", "settings.json"), "utf-8"));
    expect(gemini.mcpServers["twinmcp-my-tools"]).toEqual({
      httpUrl: "https://twinmcp.fr/api/mcp/my-tools",
    });
  });

  test("unknown server → error, nothing written", async () => {
    routeFetch({ "GET /api/v2/servers": { body: { items: [SERVER] } } });
    await run(registerSetupCommand, "setup", "--server", "ghost", "--cursor", "--project");
    expect(process.exitCode).toBe(1);
    expect(calls.some((c) => c.path === "/api/v2/auth/keys")).toBe(false);
    await expect(readFile(join(dir, ".cursor", "mcp.json"), "utf-8")).rejects.toThrow();
  });

  test("without --server and several servers, --yes asks for --server", async () => {
    routeFetch({
      "GET /api/v2/servers": {
        body: { items: [SERVER, { ...SERVER, id: "srv-2", slug: "other" }] },
      },
    });
    await run(registerSetupCommand, "setup", "--cursor", "--project", "--yes");
    expect(process.exitCode).toBe(1);
    expect(out.join("\n")).toMatch(/pass --server <slug> \(one of: my-tools, other\)/);
  });

  test("without --server and a single server, uses it", async () => {
    routeFetch({
      "GET /api/v2/servers": { body: { items: [SERVER] } },
      "POST /api/v2/auth/keys": { status: 201, body: { id: "k1", key: BOUND_KEY } },
    });
    await run(registerSetupCommand, "setup", "--cursor", "--project", "--yes");
    const cursor = JSON.parse(await readFile(join(dir, ".cursor", "mcp.json"), "utf-8"));
    expect(Object.keys(cursor.mcpServers)).toEqual(["twinmcp-my-tools"]);
  });
});
