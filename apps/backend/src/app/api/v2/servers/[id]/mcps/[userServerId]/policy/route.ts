// Tool access policy of one installed MCP (contract D2).
//
//   GET  → { policy: ToolPolicy | null, mcpSlug, mcpName }
//   PUT  { policy: ToolPolicy | null } → { ok: true, policy }
//
// Null means every tool. The proxy reads `user_servers.tool_policy` on each
// request and applies it to tools/list and tools/call (lib/mcp/tool-policy.ts).
// Management-only: an mcp_proxy key cannot change what it is allowed to call.
import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { mcpServers, userServers } from "@/db/schema/platform";
import { badRequest, forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import {
  assertServerOwnership,
  assertUserServerOwnership,
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/rbac";
import { logAudit, clientIp } from "@/lib/audit/log";
import {
  isUnrestricted,
  MAX_POLICY_TOOLS,
  MAX_TOOL_NAME_LENGTH,
  parseToolPolicy,
  TOOL_POLICY_MODES,
} from "@/lib/mcp/tool-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Names are free-form (MCP authors pick them) but bounded and printable.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const toolName = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TOOL_NAME_LENGTH)
  .refine((v) => !CONTROL_CHARS.test(v), {
    message: "Tool names may not contain control characters",
  });
const toolNames = z.array(toolName).max(MAX_POLICY_TOOLS);

const policySchema = z
  .object({
    mode: z.enum(TOOL_POLICY_MODES),
    allow: toolNames.optional(),
    deny: toolNames.optional(),
  })
  .strict();

const putSchema = z.object({ policy: policySchema.nullable() }).strict();

type Params = { params: Promise<{ id: string; userServerId: string }> };

function mapError(err: unknown, where: string) {
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof ForbiddenError) return forbidden(err.message);
  console.error(`[mcps/:id/policy ${where}]`, err);
  return serverError();
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id: serverId, userServerId } = await params;

  try {
    await assertServerOwnership(session.userId, serverId);
    const us = await assertUserServerOwnership(session.userId, userServerId);
    if (us.serverId !== serverId) return notFound("Installation not found on this server");

    const [mcp] = await getDb()
      .select({ slug: mcpServers.slug, name: mcpServers.name })
      .from(mcpServers)
      .where(eq(mcpServers.id, us.mcpServerId))
      .limit(1);

    return NextResponse.json({
      policy: parseToolPolicy(us.toolPolicy),
      mcpSlug: mcp?.slug ?? null,
      mcpName: mcp?.name ?? null,
    });
  } catch (err) {
    return mapError(err, "GET");
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id: serverId, userServerId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  // Normalize (dedupe, drop `allow` outside allow_list); store "every tool" as null.
  const normalized = parseToolPolicy(parsed.data.policy);
  const stored = isUnrestricted(normalized) ? null : normalized;

  try {
    await assertServerOwnership(session.userId, serverId);
    const us = await assertUserServerOwnership(session.userId, userServerId);
    if (us.serverId !== serverId) return notFound("Installation not found on this server");

    await getDb()
      .update(userServers)
      .set({ toolPolicy: stored })
      .where(and(eq(userServers.id, userServerId), eq(userServers.userId, session.userId)));

    const previous = parseToolPolicy(us.toolPolicy);
    logAudit({
      userId: session.userId,
      action: "mcp.tool_policy",
      targetType: "user_server",
      targetId: userServerId,
      metadata: {
        serverId,
        from: previous?.mode ?? "all",
        to: stored?.mode ?? "all",
        allowCount: stored?.allow?.length ?? 0,
        denyCount: stored?.deny?.length ?? 0,
        viaApiKey: session.apiKey ? true : undefined,
      },
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true, policy: stored });
  } catch (err) {
    return mapError(err, "PUT");
  }
}
