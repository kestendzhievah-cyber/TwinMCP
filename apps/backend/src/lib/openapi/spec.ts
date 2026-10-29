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
// Enums straight from the schema, so the docs page can't drift from the DB.
import { boxSizes, hostTypes, mcpRuntimes, serverStatuses } from "@/db/schema/platform";
import { KEY_SCOPES, ROTATION_OVERLAP_MS } from "@/lib/auth/key-scope";
import { cliCommand } from "@/lib/cli";

const VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Reusable response schemas
// ---------------------------------------------------------------------------

const ErrorResponse = z
  .object({ message: z.string() })
  .openapi("ErrorResponse", { description: "Standard error envelope" });

// 429s from the API-key routes (MCP proxy, context, libs/search) carry the
// window details from lib/errors.ts rateLimited() next to the message.
const RateLimitError = z
  .object({
    message: z.string(),
    limit: z.number().int().describe("Requests allowed per window (the plan's daily quota)"),
    remaining: z.number().int().describe("Requests left in the window (0 once rejected)"),
    resetsAt: z.string().datetime().describe("When the window resets (next UTC midnight)"),
    plan: z.enum(["free", "pro", "team"]).optional(),
    upgradeUrl: z.string().url().optional().describe("Where to raise the limit (Free accounts)"),
  })
  .openapi("RateLimitError", {
    description: "Rate-limit error envelope: the message plus the window details when known",
  });

const RATE_LIMIT_HEADERS = {
  "Retry-After": {
    description: "Seconds until the window resets",
    schema: { type: "integer" as const },
  },
  "X-RateLimit-Limit": {
    description: "Requests allowed per window",
    schema: { type: "integer" as const },
  },
  "X-RateLimit-Remaining": {
    description: "Requests left in the window",
    schema: { type: "integer" as const },
  },
  "X-RateLimit-Reset": {
    description: "When the window resets, as epoch seconds",
    schema: { type: "integer" as const },
  },
};

const OkResponse = z.object({ ok: z.literal(true) }).openapi("OkResponse");

const ServerStatus = z.enum(serverStatuses).openapi("ServerStatus");

const Server = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    hostType: z
      .enum(hostTypes)
      .describe(
        "upstash_box: an isolated Upstash Box runs the MCPs; external_url: an MCP you host yourself; local_agent: tools run on your machine via `" +
          cliCommand("connect", "--server", "<slug>") +
          "`"
      ),
    boxId: z.string().nullable(),
    boxSize: z.enum(boxSizes),
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
    runtime: z.enum(mcpRuntimes),
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

const ApiKeyScope = z.enum(KEY_SCOPES).openapi("ApiKeyScope", {
  description:
    "full: the management API (servers, keys, billing, account) and every MCP of the account. mcp_proxy: only the MCP proxy (/api/mcp/…), optionally bound to one server; any other route answers 403.",
});

const ApiKey = z
  .object({
    id: z.string(),
    prefix: z.string(),
    name: z.string().nullable(),
    scope: ApiKeyScope,
    serverId: z
      .string()
      .nullable()
      .describe("mcp_proxy only: the one server the key may call (null = any of your servers)"),
    serverName: z.string().nullable(),
    serverSlug: z.string().nullable(),
    scopeLabel: z.string().describe('"Full access", "Proxy · <server>" or "Proxy · all servers"'),
    lastUsedAt: z.string().datetime().nullable(),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        "When the key stops working (set on a key replaced by a rotation, 24 h later); null = no expiry"
      ),
    countsTowardLimit: z
      .boolean()
      .describe("False for a replaced key in its rotation overlap: it no longer holds a plan slot"),
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
    "API key authentication (create one at /dashboard). A key has a scope: `mcp_proxy` keys (the dashboard default, meant for IDE configs) only reach the MCP proxy, optionally for one server; `full` keys also reach the management API. A management route called with an `mcp_proxy` key answers 403. Revoked and expired keys answer 401.",
});

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "sb-access-token",
  description: "Supabase session cookie. Used by the dashboard.",
});

// Management routes: the dashboard cookie, or a `full`-scope API key.
const sessionAuth: Array<Record<string, string[]>> = [{ cookieAuth: [] }, { bearerAuth: [] }];
const apiKeyAuth = [{ bearerAuth: [] }];

const errorResponses = {
  400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
  403: {
    description:
      "Forbidden: quota exceeded, plan limit, or an `mcp_proxy` API key on a management route",
    content: { "application/json": { schema: ErrorResponse } },
  },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  429: {
    description: "Rate limited (daily quota exhausted)",
    headers: RATE_LIMIT_HEADERS,
    content: { "application/json": { schema: RateLimitError } },
  },
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
  description:
    "Keys that still work: not revoked and not expired. A key replaced by a rotation is listed with its `expiresAt` until it stops working.",
  security: sessionAuth,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: z.object({ keys: z.array(ApiKey) }) } },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/auth/keys",
  tags: ["API Keys"],
  summary: "Create an API key (raw value returned once)",
  description:
    'Without `scope` the key is `full` (backward compatible). For a key that goes into an IDE config, send `scope: "mcp_proxy"` and, to bind it to one server, that server\'s `serverId` (one of your servers; only allowed with `mcp_proxy`).',
  security: sessionAuth,
  request: {
    body: jsonBody(
      z.object({
        name: z.string().min(1).max(80).optional(),
        scope: ApiKeyScope.optional().describe('Defaults to "full"'),
        serverId: z.string().optional().describe('Only with scope "mcp_proxy"'),
      })
    ),
  },
  responses: {
    201: {
      description: "Key created",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            key: z.string().describe("The raw key, shown once"),
            prefix: z.string(),
            name: z.string().nullable(),
            scope: ApiKeyScope,
            serverId: z.string().nullable(),
            serverName: z.string().nullable(),
            scopeLabel: z.string(),
            expiresAt: z.null(),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/auth/keys/{id}/rotate",
  tags: ["API Keys"],
  summary: "Rotate an API key",
  description: `Mints a replacement key with the same name, scope and server binding. The old key keeps working for an overlap window (${ROTATION_OVERLAP_MS / 3_600_000} h, returned as \`oldKeyExpiresAt\`), then stops; it no longer holds a plan slot meanwhile, so rotation works at the plan limit. A key already replaced answers 409. Need the old key dead now? Revoke it (DELETE). The new key is returned once.`,
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    201: {
      description: "Rotated",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            key: z.string().describe("The raw replacement key, shown once"),
            prefix: z.string(),
            name: z.string().nullable(),
            scope: ApiKeyScope,
            serverId: z.string().nullable(),
            replacedKeyId: z.string(),
            oldKeyExpiresAt: z.string().datetime().describe("When the replaced key stops working"),
            overlapHours: z.number(),
            message: z.string(),
          }),
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
  description: "Immediate, including for a key in its rotation overlap.",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Revoked", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
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
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({ id: z.string(), email: z.string(), plan: z.string() }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/account",
  tags: ["Account"],
  summary: "Permanently delete the account (GDPR)",
  security: sessionAuth,
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
});

// ---------------------------------------------------------------------------
// /api/v2/users/me/preferences
// ---------------------------------------------------------------------------

const EmailPreferences = z
  .object({
    emailNudges: z
      .boolean()
      .describe("Receive upgrade offers, daily-quota and trial-ending emails (default true)"),
  })
  .openapi("EmailPreferences");

registry.registerPath({
  method: "get",
  path: "/api/v2/users/me/preferences",
  tags: ["Account"],
  summary: "Get email preferences",
  security: sessionAuth,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: EmailPreferences } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v2/users/me/preferences",
  tags: ["Account"],
  summary: "Update email preferences",
  security: sessionAuth,
  request: { body: jsonBody(EmailPreferences) },
  responses: {
    200: {
      description: "Updated",
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true), emailNudges: z.boolean() }),
        },
      },
    },
    ...errorResponses,
  },
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
    200: {
      description: "OK",
      content: { "application/json": { schema: z.object({ items: z.array(Server) }) } },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v2/servers",
  tags: ["Servers"],
  summary: "Create a new server (provisions an Upstash Box async)",
  description: "Auto-installs the official `twinmcp-docs` MCP. Quota: free=1, pro=50.",
  security: sessionAuth,
  request: { body: jsonBody(createServerSchema) },
  responses: {
    201: {
      description: "Created",
      content: {
        "application/json": {
          schema: z.object({ id: z.string(), slug: z.string(), status: ServerStatus }),
        },
      },
    },
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
  responses: {
    200: { description: "OK", content: { "application/json": { schema: Server } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v2/servers/{id}",
  tags: ["Servers"],
  summary: "Update a server (rename, resize)",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }), body: jsonBody(updateServerSchema) },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/servers/{id}",
  tags: ["Servers"],
  summary: "Delete a server (and its Upstash Box runtime)",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
});

// Lifecycle (contract K4). Pause keeps the box and its data; Delete runtime and
// Restart destroy the box and require the server's exact name as confirmation.
const ConfirmNameBody = z.object({
  confirmName: z.string().describe("The server's exact name, as typed confirmation"),
});
const lifecycleOps: Array<{
  action: "start" | "resume" | "pause" | "stop" | "restart";
  summary: string;
  description: string;
  confirm?: boolean;
}> = [
  {
    action: "start",
    summary: "Start a server",
    description:
      "Wakes a paused server in place (data kept), or provisions a fresh runtime from the saved configs when it has none.",
  },
  { action: "resume", summary: "Resume a paused server", description: "Same handler as /start." },
  {
    action: "pause",
    summary: "Pause a server (data kept)",
    description:
      "Pauses the box: installed packages, files and logs are kept. The next MCP request or /resume wakes it.",
  },
  {
    action: "stop",
    summary: "Pause a server (legacy alias)",
    description: "Kept for API compatibility: same handler as /pause, nothing is deleted.",
  },
  {
    action: "restart",
    summary: "Restart on a fresh runtime (destructive)",
    description:
      "Deletes the box and every file on it, then provisions a fresh one from the saved configs. Requires { confirmName }. To stop serving without losing data, use /pause.",
    confirm: true,
  },
];
for (const op of lifecycleOps) {
  registry.registerPath({
    method: "post",
    path: `/api/v2/servers/{id}/${op.action}`,
    tags: ["Servers"],
    summary: op.summary,
    description: op.description,
    security: sessionAuth,
    request: op.confirm
      ? { params: z.object({ id: z.string() }), body: jsonBody(ConfirmNameBody) }
      : { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(true), status: z.string() }),
          },
        },
      },
      ...errorResponses,
    },
  });
}

registry.registerPath({
  method: "delete",
  path: "/api/v2/servers/{id}/runtime",
  tags: ["Servers"],
  summary: "Delete a server's runtime (destructive)",
  description:
    "Destroys the box and everything on its disk. The server, its MCP list, their configs and the API keys are kept; /start provisions a fresh box. Requires { confirmName }.",
  security: sessionAuth,
  request: { params: z.object({ id: z.string() }), body: jsonBody(ConfirmNameBody) },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
});

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
    201: {
      description: "Installed",
      content: {
        "application/json": { schema: z.object({ id: z.string(), mcpServerId: z.string() }) },
      },
    },
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
  responses: {
    200: { description: "OK", content: { "application/json": { schema: UserServer } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v2/servers/{id}/mcps/{userServerId}",
  tags: ["MCP installations"],
  summary: "Toggle / reconfigure an installation (config uses MERGE semantics)",
  description:
    "Missing or empty fields in `config` keep their existing value, useful for not re-sending secrets.",
  security: sessionAuth,
  request: {
    params: z.object({ id: z.string(), userServerId: z.string() }),
    body: jsonBody(updateUserServerSchema),
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/servers/{id}/mcps/{userServerId}",
  tags: ["MCP installations"],
  summary: "Uninstall an MCP",
  security: sessionAuth,
  request: { params: z.object({ id: z.string(), userServerId: z.string() }) },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
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
  summary: "Publish an MCP to the catalog (Pro only)",
  security: sessionAuth,
  request: { body: jsonBody(createMcpServerSchema) },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: z.object({ id: z.string(), slug: z.string() }) } },
    },
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
  responses: {
    200: { description: "OK", content: { "application/json": { schema: McpServer } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v2/mcp-servers/{slug}",
  tags: ["Catalog"],
  summary: "Delete a catalog entry (publisher only, non-official)",
  security: sessionAuth,
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
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
    201: {
      description: "Created",
      content: { "application/json": { schema: z.object({ id: z.string(), name: z.string() }) } },
    },
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
  responses: {
    200: { description: "OK", content: { "application/json": { schema: OkResponse } } },
    ...errorResponses,
  },
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
  method: "post",
  path: "/api/v2/billing/checkout",
  tags: ["Billing"],
  summary: "Create a Stripe checkout session",
  description:
    'Pro is the only plan sold. plan "team" is no longer available and returns 400. An account with an active, trialing or past-due subscription gets a Customer Portal URL instead of a new checkout.',
  security: sessionAuth,
  request: {
    body: jsonBody(
      z.object({
        plan: z.enum(["pro"]),
        cadence: z.enum(["monthly", "yearly"]).default("monthly"),
        promotionCodeId: z.string().optional().describe("Stripe promotion code id (promo_…)"),
        creatorSlug: z.string().optional().describe("Creator landing slug, for attribution"),
        from: z
          .enum(["billing", "onboarding", "pricing", "signup"])
          .optional()
          .describe("Surface that opened the checkout; decides the success / cancel URLs"),
      })
    ),
  },
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            url: z.string().url(),
            kind: z.enum(["checkout", "portal"]),
          }),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/billing/checkout/start",
  tags: ["Billing"],
  summary: "Open a Pro checkout by navigation (303 to Stripe)",
  description:
    "Browser navigation twin of POST /api/v2/billing/checkout, used after an email confirmation that carries a Pro intent. Redirects (303) to Stripe Checkout, or to the Customer Portal for a subscribed account; without a session, to sign-in; on failure, to /dashboard/billing?checkout=error&reason=price|stripe|unknown. Only plan=pro (or the legacy team alias) is accepted; a cross-site navigation is bounced to /dashboard/billing, which reopens the checkout itself.",
  security: sessionAuth,
  request: {
    query: z.object({
      plan: z.enum(["pro"]).optional(),
      cadence: z.enum(["monthly", "yearly"]).optional(),
      promo: z.string().optional().describe("Creator slug or Stripe promotion code id"),
      from: z.enum(["billing", "onboarding", "pricing", "signup"]).optional(),
    }),
  },
  responses: {
    303: { description: "Redirect to Stripe Checkout, the portal, sign-in or Billing" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v2/billing/portal",
  tags: ["Billing"],
  summary: "Open the Stripe customer billing portal",
  security: sessionAuth,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: z.object({ url: z.string().url() }) } },
    },
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
    200: {
      description: "Plain text documentation",
      content: { "text/plain": { schema: z.string() } },
    },
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
    200: {
      description: "OK",
      content: { "application/json": { schema: z.object({ libraries: z.array(z.unknown()) }) } },
    },
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
    "Authenticated by API key (`full`, or `mcp_proxy` bound to this server or unbound). The control plane resolves the server + installation and either handles it locally (twinmcp-docs) or forwards to the box endpoint. A key bound to another server answers HTTP 403 with JSON-RPC error code -32003.",
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
      contact: { name: "TwinMCP", url: "https://twinmcp.fr" },
    },
    servers: originUrl
      ? [{ url: originUrl, description: "Current host" }]
      : [{ url: "https://twinmcp.fr", description: "Production" }],
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
