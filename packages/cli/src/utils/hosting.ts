// Hosting helpers for the management REST API (/api/v2): key resolution, URL
// building, `--config KEY=VALUE` parsing and error wording. Everything except
// the `HostingClient` methods is pure so it can be unit-tested without a
// network. Request and response shapes mirror the backend routes:
//   GET/POST /api/v2/servers               → { items } / { id, slug, status }
//   GET/POST /api/v2/servers/:id/mcps      → { items } / { id, mcpServerId }
//   GET      /api/v2/mcp-servers?q=        → { items, nextCursor }
//   GET      /api/v2/mcp-servers/:slug     → catalog row (id, configSchema, …)
//   POST     /api/v2/auth/keys             → { id, key, scope, serverId, … }

export const API_KEY_PREFIX = "ctx7sk_";
export const DASHBOARD_URL = "https://twinmcp.fr/dashboard";
export const BOX_SIZES = ["small", "medium", "large"] as const;
export type BoxSize = (typeof BOX_SIZES)[number];

/** Same rule as the backend's slugSchema. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function isValidSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 64 && SLUG_RE.test(value);
}

export function isApiKey(value: string | undefined | null): value is string {
  return typeof value === "string" && value.startsWith(API_KEY_PREFIX) && value.length > 12;
}

export type KeySource = "flag" | "env" | "stored";

/**
 * Picks the management key: `--key` flag, then TWINMCP_API_KEY, then the key
 * saved by `twinmcp login`. A flag that is not a ctx7sk_ key is an error (the
 * user typed it on purpose); an env/stored value that is not one (e.g. an old
 * OAuth token in credentials.json) is skipped.
 */
export function resolveApiKey(sources: {
  flag?: string;
  env?: string;
  stored?: string | null;
}): { key: string; source: KeySource } | null {
  if (sources.flag !== undefined) {
    if (!isApiKey(sources.flag)) {
      throw new Error(`--key must be a TwinMCP API key starting with ${API_KEY_PREFIX}`);
    }
    return { key: sources.flag, source: "flag" };
  }
  if (isApiKey(sources.env)) return { key: sources.env, source: "env" };
  if (isApiKey(sources.stored)) return { key: sources.stored, source: "stored" };
  return null;
}

export const NO_KEY_MESSAGE =
  `No TwinMCP API key found. Create a full-access key in the dashboard (${DASHBOARD_URL}), ` +
  "then run `twinmcp login --key ctx7sk_…` or set TWINMCP_API_KEY.";

/** "ctx7sk_abcd…wxyz" — enough to recognise a key without printing it. */
export function maskKey(key: string): string {
  if (key.length <= 16) return `${key.slice(0, 7)}…`;
  return `${key.slice(0, 11)}…${key.slice(-4)}`;
}

/**
 * The connection URL for a server: the aggregated whole-server endpoint, or
 * one MCP's endpoint with `mcp`. Router mode (search_tools / get_tool_schema /
 * call_tool) only exists on the aggregated endpoint.
 */
export function buildServerUrl(
  baseUrl: string,
  serverSlug: string,
  opts: { mcp?: string; router?: boolean } = {}
): string {
  if (opts.mcp && opts.router) {
    throw new Error("--router applies to the whole-server URL; drop --mcp or --router.");
  }
  const base = `${baseUrl.replace(/\/+$/, "")}/api/mcp/${encodeURIComponent(serverSlug)}`;
  if (opts.mcp) return `${base}/${encodeURIComponent(opts.mcp)}`;
  return opts.router ? `${base}?mode=router` : base;
}

/** The entry name written into a client config (matches the dashboard). */
export function serverEntryLabel(serverSlug: string): string {
  return `twinmcp-${serverSlug}`;
}

/** Parses repeated `KEY=VALUE` pairs. Splits on the first `=` only. */
export function parseConfigPairs(pairs: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs ?? []) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      throw new Error(`Invalid --config value "${pair}". Use KEY=VALUE.`);
    }
    const key = pair.slice(0, eq).trim();
    if (!key) throw new Error(`Invalid --config value "${pair}". Use KEY=VALUE.`);
    out[key] = pair.slice(eq + 1);
  }
  return out;
}

export interface ConfigProperty {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
  secret?: boolean;
}

export interface ConfigSchema {
  properties?: Record<string, ConfigProperty>;
}

export type ConfigValue = string | number | boolean;

/**
 * Converts the raw strings to the types the catalog entry declares (the API
 * rejects `"8080"` for a number field) and checks required keys up front, so
 * the user gets every problem at once instead of one 400 at a time.
 */
export function coerceConfig(
  raw: Record<string, string>,
  schema: ConfigSchema | null | undefined
): { config: Record<string, ConfigValue>; errors: string[]; unknown: string[] } {
  const props = schema?.properties ?? {};
  const config: Record<string, ConfigValue> = {};
  const errors: string[] = [];
  const unknown: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const def = props[key];
    if (!def) {
      unknown.push(key);
      config[key] = value;
      continue;
    }
    if (def.type === "number") {
      const n = Number(value);
      if (value.trim() === "" || !Number.isFinite(n)) {
        errors.push(`${key} must be a number`);
      } else {
        config[key] = n;
      }
    } else if (def.type === "boolean") {
      const v = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(v)) config[key] = true;
      else if (["false", "0", "no", "off"].includes(v)) config[key] = false;
      else errors.push(`${key} must be true or false`);
    } else {
      config[key] = value;
    }
  }

  for (const [key, def] of Object.entries(props)) {
    if (def.required && (config[key] === undefined || config[key] === "")) {
      if (!errors.some((e) => e.startsWith(`${key} `))) {
        errors.push(`missing required config ${key}`);
      }
    }
  }

  return { config, errors, unknown };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** One readable sentence for a failed management call. */
export function describeApiError(
  status: number,
  body: { message?: string; error?: string; code?: string } | null,
  retryAfter?: string | null
): string {
  const serverMessage = body?.message || body?.error;
  if (status === 401) {
    return (
      "TwinMCP rejected the API key (unknown, revoked or expired). " +
      "Run `twinmcp login --key ctx7sk_…` with a full-access key from the dashboard."
    );
  }
  if (status === 403 && body?.code === "key_scope") {
    return (
      "This key can only call MCP servers (scope mcp_proxy). The management commands need a " +
      `full-access key: create one at ${DASHBOARD_URL} and run \`twinmcp login --key ctx7sk_…\`.`
    );
  }
  if (status === 429) {
    const wait = retryAfter && /^\d+$/.test(retryAfter) ? ` Retry in ${retryAfter}s.` : "";
    return `${serverMessage || "Too many requests."}${wait}`;
  }
  if (serverMessage) return serverMessage;
  if (status >= 500) return `TwinMCP returned HTTP ${status}. Try again in a moment.`;
  return `Request failed with HTTP ${status}.`;
}

export interface HostedServer {
  id: string;
  name: string;
  slug: string;
  hostType: string;
  boxSize: string;
  region: string | null;
  endpointUrl: string | null;
  status: string;
  lastHeartbeatAt: string | null;
  createdAt: string;
}

export interface InstalledMcp {
  id: string;
  mcpServerId: string;
  enabled: boolean;
  installedAt: string;
  mcpSlug: string;
  mcpName: string;
  mcpRuntime: string;
  mcpVersion: string;
}

export interface CatalogMcp {
  id: string;
  slug: string;
  name: string;
  description?: string;
  runtime?: string;
  version?: string;
  hostMode?: string;
  configSchema?: ConfigSchema | null;
}

export interface CreatedKey {
  id: string;
  key: string;
  prefix: string;
  name: string | null;
  scope: string;
  serverId: string | null;
  serverName: string | null;
}

/** Finds a server by slug (preferred) or id. */
export function findServer(servers: HostedServer[], ref: string): HostedServer | undefined {
  return servers.find((s) => s.slug === ref) ?? servers.find((s) => s.id === ref);
}

/** Left-aligned plain-text table (no colours, so it pipes cleanly). */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i])))
      .join("  ")
      .trimEnd();
  return [line(headers), ...rows.map(line)].join("\n");
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Thin client for the management API, authenticated with a full-access key. */
export class HostingClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ApiError(`Could not reach ${this.baseUrl} (${reason}).`, 0);
    }
    const parsed = (await res.json().catch(() => null)) as
      | (T & { message?: string; error?: string; code?: string })
      | null;
    if (!res.ok) {
      throw new ApiError(
        describeApiError(res.status, parsed, res.headers?.get?.("retry-after")),
        res.status,
        parsed?.code
      );
    }
    return parsed as T;
  }

  async listServers(): Promise<HostedServer[]> {
    const data = await this.request<{ items: HostedServer[] }>("GET", "/api/v2/servers");
    return data.items ?? [];
  }

  /** Resolves a slug or id to the server; a clear error when it is not there. */
  async getServer(ref: string): Promise<HostedServer> {
    const server = findServer(await this.listServers(), ref);
    if (!server) {
      throw new ApiError(
        `No server "${ref}" in your account. Run \`twinmcp servers list\` to see your servers.`,
        404
      );
    }
    return server;
  }

  createServer(input: {
    name: string;
    slug?: string;
    boxSize?: BoxSize;
    hostType?: "upstash_box" | "local_agent";
  }): Promise<{ id: string; slug: string; status: string }> {
    return this.request("POST", "/api/v2/servers", input);
  }

  async listServerMcps(serverId: string): Promise<InstalledMcp[]> {
    const data = await this.request<{ items: InstalledMcp[] }>(
      "GET",
      `/api/v2/servers/${encodeURIComponent(serverId)}/mcps`
    );
    return data.items ?? [];
  }

  getCatalogMcp(slug: string): Promise<CatalogMcp> {
    return this.request("GET", `/api/v2/mcp-servers/${encodeURIComponent(slug)}`);
  }

  async searchCatalog(query: string | undefined, limit = 50): Promise<CatalogMcp[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set("q", query);
    const data = await this.request<{ items: CatalogMcp[] }>(
      "GET",
      `/api/v2/mcp-servers?${params.toString()}`
    );
    return data.items ?? [];
  }

  installMcp(
    serverId: string,
    mcpServerId: string,
    config: Record<string, ConfigValue>
  ): Promise<{ id: string; mcpServerId: string }> {
    return this.request("POST", `/api/v2/servers/${encodeURIComponent(serverId)}/mcps`, {
      mcpServerId,
      config,
    });
  }

  /** Mints a key that can only call MCPs of one server (scope mcp_proxy). */
  createProxyKey(serverId: string, name: string): Promise<CreatedKey> {
    return this.request("POST", "/api/v2/auth/keys", {
      name: name.slice(0, 80),
      scope: "mcp_proxy",
      serverId,
    });
  }
}
