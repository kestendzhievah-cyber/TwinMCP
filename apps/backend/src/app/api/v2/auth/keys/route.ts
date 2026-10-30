import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { apiKeys, servers } from "@/db/schema";
import { generateApiKey } from "@/lib/auth";
import {
  badRequest,
  forbidden,
  jsonError,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/errors";
import { requireKeyManager, requireManagementUser } from "@/lib/session";
import {
  countsTowardKeyLimit,
  isKeyUsable,
  keyScopeLabel,
  KEY_SCOPES,
  type KeyScope,
} from "@/lib/auth/key-scope";
import { limitFor, minPlanForLimit } from "@/lib/plan-features";
import { getEntitlements } from "@/lib/wallet/entitlements";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { checkExternalUserId } from "@/lib/vault/key-meta";
import { audit, auditCtxFromRequest } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `scope` defaults to "full" so existing scripts that POST { name } keep
// getting the key they always got. The dashboard asks for "mcp_proxy".
const createSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    scope: z.enum(KEY_SCOPES).optional(),
    serverId: z.string().min(1).max(64).optional(),
    // Agencies: their own id for the end customer this key is for (≤ 128
    // chars, mcp_proxy only; checked by checkExternalUserId below).
    externalUserId: z.string().max(512).nullable().optional(),
  })
  .refine((b) => !b.serverId || b.scope === "mcp_proxy", {
    message: 'serverId is only allowed with scope "mcp_proxy".',
    path: ["serverId"],
  });

function rateLimited(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return jsonError(429, "Too many API-key operations. Please wait a moment and try again.", {
    retryAfter,
  });
}

export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const rows = await getDb()
      .select({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        name: apiKeys.name,
        scope: apiKeys.scope,
        serverId: apiKeys.serverId,
        serverName: servers.name,
        serverSlug: servers.slug,
        externalUserId: apiKeys.externalUserId,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .leftJoin(servers, eq(servers.id, apiKeys.serverId))
      .where(and(eq(apiKeys.userId, session.userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));
    const now = Date.now();
    // Expired keys are dead (authenticateRequest rejects them): leave them out.
    const keys = rows
      .filter((r) => isKeyUsable(r, now))
      .map(({ revokedAt: _revokedAt, ...r }) => ({
        ...r,
        scopeLabel: keyScopeLabel(r),
        // A replaced key in its rotation overlap: still works, frees its slot.
        countsTowardLimit: countsTowardKeyLimit({ revokedAt: null, expiresAt: r.expiresAt }, now),
      }));
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[auth/keys GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireKeyManager(req);
  if (session instanceof NextResponse) return session;

  const rl = await checkAuthWriteLimit(session.userId, "key_create");
  if (!rl.ok) {
    const response = rateLimited(rl.reset);
    response.headers.set(
      "Retry-After",
      String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)))
    );
    return response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  const scope: KeyScope = parsed.data.scope ?? "full";
  const serverId = parsed.data.serverId ?? null;
  const ext = checkExternalUserId(parsed.data.externalUserId, scope);
  if (!ext.ok) return badRequest(ext.message);
  const externalUserId = ext.value;

  try {
    const db = getDb();

    // A bound key must point at one of the caller's own live servers.
    let serverName: string | null = null;
    if (serverId) {
      const [srv] = await db
        .select({ name: servers.name })
        .from(servers)
        .where(
          and(
            eq(servers.id, serverId),
            eq(servers.userId, session.userId),
            ne(servers.status, "destroyed")
          )
        )
        .limit(1);
      if (!srv) return notFound("Server not found");
      serverName = srv.name;
    }

    // Enforce the per-plan API key allowance. Keys are account-level, so we
    // count the user's active (non-revoked) keys against their plan limit.
    // The tier comes from the wallet (getEntitlements), never users.plan.
    const ent = await getEntitlements(session.userId);
    if (!ent) return unauthorized("User not found");

    const limit = limitFor(ent.tier, "apiKeys");
    // Replaced keys still in their 24 h rotation overlap don't hold a slot.
    const now = Date.now();
    const active = (
      await db
        .select({ revokedAt: apiKeys.revokedAt, expiresAt: apiKeys.expiresAt })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, session.userId), isNull(apiKeys.revokedAt)))
    ).filter((k) => countsTowardKeyLimit(k, now));
    if (active.length >= limit) {
      const required = minPlanForLimit("apiKeys", active.length + 1);
      const upsell = required ? " Top up your TwinMCP credit to raise it." : "";
      return forbidden(
        `You've reached your account's limit of ${limit} API key${limit > 1 ? "s" : ""}.${upsell}`
      );
    }

    const { raw, prefix, hash } = generateApiKey();
    const id = randomUUID();
    await db.insert(apiKeys).values({
      id,
      userId: session.userId,
      keyHash: hash,
      prefix,
      name: parsed.data.name ?? null,
      scope,
      serverId,
      externalUserId,
    });
    {
      const ctx = auditCtxFromRequest(req);
      audit({
        userId: session.userId,
        action: "api_key.create",
        targetType: "api_key",
        targetId: id,
        ip: ctx.ip,
        metadata: {
          prefix,
          name: parsed.data.name ?? null,
          scope,
          serverId,
          externalUserId,
          userAgent: ctx.userAgent,
        },
      });
    }
    // Activation funnel (fire-and-forget; trackServer never throws). Never the
    // key itself — only how many the account now holds.
    trackServer({
      event: "key_created",
      distinctId: session.userId,
      properties: {
        plan: ent.displayPlan,
        keyCount: active.length + 1,
        named: !!parsed.data.name,
        scope,
        bound: !!serverId,
        endCustomer: !!externalUserId,
      },
    });
    return NextResponse.json(
      {
        id,
        key: raw,
        prefix,
        name: parsed.data.name ?? null,
        scope,
        serverId,
        serverName,
        externalUserId,
        scopeLabel: keyScopeLabel({ scope, serverName }),
        expiresAt: null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[auth/keys POST]", err);
    return serverError();
  }
}
