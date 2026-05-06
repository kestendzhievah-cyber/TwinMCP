import "./extend";
import { z } from "zod";
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
  createServerSchema,
  updateServerSchema,
  createMcpServerSchema,
  installMcpSchema,
  updateUserServerSchema,
  configSchemaShape,
} from "@/lib/validation/platform";

const VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Reusable response schemas
// ---------------------------------------------------------------------------

const ErrorResponse = z
  .object({ message: z.string() })
  .openapi("ErrorResponse", { description: "Standard error envelope" });

const OkResponse = z.object({ ok: z.literal(true) }).openapi("OkResponse");

const ServerStatus = z
  .enum(["provisioning", "running", "stopped", "error", "destroyed"])
  .openapi("ServerStatus");

const Server = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    hostType: z.enum(["upstash_box", "external_url"]),
    boxId: z.string().nullable(),
    boxSize: z.enum(["small", "medium", "large"]),
    region: z.string().nullable(),
    endpointUrl: z.string().nullable(),
    status: ServerStatus,
    lastHeartbeatAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Server");

const McpServer = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    runtime: z.enum(["node", "node-alpine", "python", "python-alpine", "go", "golang-alpine", "ruby", "rust"]),
    version: z.string(),
    repoUrl: z.string().nullable(),
    isOfficial: z.boolean(),
    isPublic: z.boolean(),
    publishedByUserId: z.string().nullable(),
    configSchema: configSchemaShape,
    createdAt: z.string().datetime(),
  })
  .openapi("McpServer");

const UserServer = z
  .object({
    id: z.string(),
    mcpServerId: z.string(),
    mcpSlug: z.string(),
    mcpName: z.string(),
    mcpDescription: z.string(),
    mcpRuntime: z.string(),
    mcpVersion: z.string(),
    configSchema: configSchemaShape,
    config: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    enabled: z.boolean(),
    installedAt: z.string().datetime(),
  })
  .openapi("UserServer");

const ApiKey = z
  .object({
    id: z.string(),
    prefix: z.string(),
    name: z.string().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("ApiKey");

const LogLine = z
  .object({
    ts: z.string().datetime().nullable(),
    source: z.string(),
    message: z.string(),
  })
  .openapi("LogLine");

// ---------------------------------------------------------------------------
// Registry & shared helpers
// ---------------------------------------------------------------------------

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "ctx7sk_…",
  description:
    "API key authentication. Create one at /dashboard. Used by MCP clients and SDK.",
});

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "sb-access-token",
  description: "Supabase session cookie. Used by the dashboard.",
});

const sessionAuth = [{ cookieAuth: [] }];
const apiKeyAuth = [{ bearerAuth: [] }];
const eitherAuth = [{ cookieAuth: [] }, { bearerAuth: [] }];

const errorResponses = {
  400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
  403: { description: "Forbidden / quota exceeded", content: { "application/json": { schema: ErrorResponse } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  429: { description: "Rate limited", content: { "application/json": { schema: ErrorResponse } } },
  500: { description: "Server error", content: { "application/json": { schema: ErrorResponse } } },
};

function jsonBody<T extends z.ZodType>(schema: T) {
  return { content: { "application/json": { schema } } };
}

// ---------------------------------------------------------------------------
// /api/v2/auth/keys
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v2/auth/keys",
  tags: ["API Keys"],
  summary: "List active API keys",
  security: sessionAuth,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ keys: z.array(ApiKey) }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/auth/keys",
  tags: ["API Keys"],
  summary: "Create an API key (raw value returned once)",
  security: sessionAuth,
  request: { body: jsonBody(z.object({ name: z.string().min(1).max(80).optional() })) },
  responses: {
    201: {
      description: "Key created",
      content: {
        "application/json": {
          schema: z.object({ id: z.string(), key: z.string(), prefix: z.string() }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/auth/keys/{id}",
  tags: ["API Keys"],
  summary: "Revoke an API key",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Revoked", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

// ---------------------------------------------------------------------------
// /api/v2/account
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v2/account",
  tags: ["Account"],
  summary: "Get current account info",
  security: sessionAuth,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ id: z.string(), email: z.string(), plan: z.string() }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/account",
  tags: ["Account"],
  summary: "Permanently delete the account (GDPR)",
  security: sessionAuth,
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

// ---------------------------------------------------------------------------
// /api/v2/servers
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v2/servers",
  tags: ["Servers"],
  summary: "List servers owned by the current user",
  security: sessionAuth,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ items: z.array(Server) }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/servers",
  tags: ["Servers"],
  summary: "Create a new server (provisions an Upstash Box async)",
  description:
    "Auto-installs the official `twinmcp-docs` MCP. Quota: free=1, pro=25.",
  security: sessionAuth,
  request: { body: jsonBody(createServerSchema) },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: z.object({ id: z.string(), slug: z.string(), status: ServerStatus }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/servers/{id}",
  tags: ["Servers"],
  summary: "Get a server by ID",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: Server } } }, ...errorResponses },
});

registry.registerPath({
  method: "patch",
  path: "/api/v2/servers/{id}",
  tags: ["Servers"],
  summary: "Update a server (rename, resize)",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }), body: jsonBody(updateServerSchema) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/servers/{id}",
  tags: ["Servers"],
  summary: "Delete a server (and its Upstash Box runtime)",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

for (const action of ["start", "stop", "restart"] as const) {
  registry.registerPath({
    method: "post",
    path: `/api/v2/servers/{id}/${action}`,
    tags: ["Servers"],
    summary: `${action[0].toUpperCase()}${action.slice(1)} a server`,
    security: sessionAuth,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.literal(true), status: ServerStatus }) } } },
      ...errorResponses,
    },
  });
}

registry.registerPath({
  method: "get",
  path: "/api/v2/servers/{id}/health",
  tags: ["Servers"],
  summary: "Server health (DB status + live ping)",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            status: ServerStatus,
            live: z.boolean().nullable(),
            boxId: z.string().nullable(),
            endpointUrl: z.string().nullable(),
            lastHeartbeatAt: z.string().datetime().nullable(),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/servers/{id}/logs",
  tags: ["Servers"],
  summary: "Tail logs from the server's box",
  description:
    "`?slug=all` (default) merges all installed MCPs. `?slug=<mcp>` filters one. `?slug=twinmcp-docs` synthesizes from usage_events.",
  security: sessionAuth,
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({
      slug: z.string().optional().default("all"),
      lines: z.coerce.number().int().min(1).max(2000).optional().default(200),
    }),
  },
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            slug: z.string(),
            source: z.enum(["box", "control-plane"]),
            boxId: z.string().nullable(),
            fetchedAt: z.string().datetime(),
            lines: z.array(LogLine),
            notice: z.string().optional(),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

// ---------------------------------------------------------------------------
// /api/v2/servers/{id}/mcps
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v2/servers/{id}/mcps",
  tags: ["MCP installations"],
  summary: "List MCPs installed on this server",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                mcpServerId: z.string(),
                enabled: z.boolean(),
                installedAt: z.string().datetime(),
                mcpSlug: z.string(),
                mcpName: z.string(),
                mcpRuntime: z.string(),
                mcpVersion: z.string(),
              })
            ),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/servers/{id}/mcps",
  tags: ["MCP installations"],
  summary: "Install an MCP from the catalog onto this server",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }), body: jsonBody(installMcpSchema) },
  responses: {
    201: { description: "Installed", content: { "application/json": { schema: z.object({ id: z.string(), mcpServerId: z.string() }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/servers/{id}/mcps/{userServerId}",
  tags: ["MCP installations"],
  summary: "Get an installation (config returned with secrets masked as null)",
  security: sessionAuth,
  request: { params: z.object({ id: z.string(), userServerId: z.string() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: UserServer } } }, ...errorResponses },
});

registry.registerPath({
  method: "patch",
  path: "/api/v2/servers/{id}/mcps/{userServerId}",
  tags: ["MCP installations"],
  summary: "Toggle / reconfigure an installation (config uses MERGE semantics)",
  description: "Missing or empty fields in `config` keep their existing value, useful for not re-sending secrets.",
  security: sessionAuth,
  request: {
    params: z.object({ id: z.string(), userServerId: z.string() }),
    body: jsonBody(updateUserServerSchema),
  },
  responses: { 200: { description: "OK", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/servers/{id}/mcps/{userServerId}",
  tags: ["MCP installations"],
  summary: "Uninstall an MCP",
  security: sessionAuth,
  request: { params: z.object({ id: z.string(), userServerId: z.string() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

// ---------------------------------------------------------------------------
// /api/v2/mcp-servers (catalog)
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v2/mcp-servers",
  tags: ["Catalog"],
  summary: "List the MCP catalog",
  security: sessionAuth,
  request: {
    query: z.object({
      q: z.string().optional(),
      runtime: z.string().optional(),
      official: z.enum(["true", "false"]).optional(),
      cursor: z.string().datetime().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
  },
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(McpServer.partial({ configSchema: true })),
            nextCursor: z.string().datetime().nullable(),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/mcp-servers",
  tags: ["Catalog"],
  summary: "Publish an MCP to the catalog (Pro/Team only)",
  security: sessionAuth,
  request: { body: jsonBody(createMcpServerSchema) },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: z.object({ id: z.string(), slug: z.string() }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/mcp-servers/{slug}",
  tags: ["Catalog"],
  summary: "Get a catalog entry by slug",
  security: sessionAuth,
  request: { params: z.object({ slug: z.string() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: McpServer } } }, ...errorResponses },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/mcp-servers/{slug}",
  tags: ["Catalog"],
  summary: "Delete a catalog entry (publisher only, non-official)",
  security: sessionAuth,
  request: { params: z.object({ slug: z.string() }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

// ---------------------------------------------------------------------------
// Other endpoints
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v2/team",
  tags: ["Team"],
  summary: "Create a teamspace",
  security: sessionAuth,
  request: { body: jsonBody(z.object({ name: z.string().min(1).max(80) })) },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: z.object({ id: z.string(), name: z.string() }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v2/policies",
  tags: ["Team"],
  summary: "Update teamspace library policies",
  security: sessionAuth,
  request: {
    body: jsonBody(
      z.object({
        teamspaceId: z.string(),
        minTrustScore: z.number().min(0).max(10),
        blockedLibraryIds: z.array(z.string()),
      })
    ),
  },
  responses: { 200: { description: "OK", content: { "application/json": { schema: OkResponse } } }, ...errorResponses },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/usage",
  tags: ["Account"],
  summary: "Usage metrics for the current user",
  security: sessionAuth,
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            today: z.number().int(),
            limit: z.number().int(),
            plan: z.string(),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/billing/checkout",
  tags: ["Billing"],
  summary: "Create a Stripe checkout session",
  security: sessionAuth,
  request: { query: z.object({ plan: z.enum(["pro", "team"]) }) },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ checkoutUrl: z.string().url() }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/billing/portal",
  tags: ["Billing"],
  summary: "Open the Stripe customer billing portal",
  security: sessionAuth,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ url: z.string().url() }) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/context",
  tags: ["Library context"],
  summary: "Retrieve documentation chunks for a library (legacy endpoint)",
  description:
    "Vector search over indexed library chunks. Authenticated via API key (Bearer ctx7sk_…). Returns text/plain.",
  security: apiKeyAuth,
  request: {
    query: z.object({
      query: z.string(),
      libraryId: z.string().describe("e.g. /facebook/react"),
    }),
  },
  responses: {
    200: { description: "Plain text documentation", content: { "text/plain": { schema: z.string() } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/libs/search",
  tags: ["Library context"],
  summary: "Search the indexed library catalog (trigram + filters)",
  security: apiKeyAuth,
  request: {
    query: z.object({
      libraryName: z.string(),
      query: z.string().optional(),
    }),
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ libraries: z.array(z.unknown()) }) } } },
    ...errorResponses,
  },
});

// ---------------------------------------------------------------------------
// MCP proxy (called by MCP clients, JSON-RPC 2.0)
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/mcp/{serverSlug}/{mcpSlug}",
  tags: ["MCP proxy"],
  summary: "Proxy MCP JSON-RPC requests to a user's installed MCP",
  description:
    "Authenticated by API key. The control plane resolves the server + installation and either handles it locally (twinmcp-docs) or forwards to the box endpoint.",
  security: apiKeyAuth,
  request: {
    params: z.object({ serverSlug: z.string(), mcpSlug: z.string() }),
    body: jsonBody(
      z.object({
        jsonrpc: z.literal("2.0"),
        id: z.union([z.number(), z.string(), z.null()]).optional(),
        method: z.string(),
        params: z.record(z.unknown()).optional(),
      })
    ),
  },
  responses: {
    200: {
      description: "JSON-RPC response (result or error envelope)",
      content: {
        "application/json": {
          schema: z.object({
            jsonrpc: z.literal("2.0"),
            id: z.union([z.number(), z.string(), z.null()]),
            result: z.unknown().optional(),
            error: z.object({ code: z.number(), message: z.string() }).optional(),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

// ---------------------------------------------------------------------------
// Spec generator
// ---------------------------------------------------------------------------

export function buildOpenApiSpec(originUrl?: string) {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "TwinMCP API",
      version: VERSION,
      description:
        "Control plane API for TwinMCP — user-hosted MCP runtimes on Upstash Box. Two auth modes: Supabase session cookie (dashboard) and API key (`Authorization: Bearer ctx7sk_…`) for SDK / MCP clients.",
      contact: { name: "TwinMCP", url: "https://twinmcp.com" },
    },
    servers: originUrl
      ? [{ url: originUrl, description: "Current host" }]
      : [{ url: "https://twinmcp.com", description: "Production" }],
    tags: [
      { name: "Servers", description: "User-owned runtime instances" },
      { name: "MCP installations", description: "MCPs installed on a specific server" },
      { name: "Catalog", description: "Browse and publish MCPs" },
      { name: "MCP proxy", description: "JSON-RPC entry point for MCP clients" },
      { name: "API Keys", description: "Authentication credentials" },
      { name: "Account", description: "User account and usage" },
      { name: "Team", description: "Teamspaces and policies" },
      { name: "Billing", description: "Stripe subscription management" },
      { name: "Library context", description: "Documentation retrieval (legacy)" },
    ],
  });
}
