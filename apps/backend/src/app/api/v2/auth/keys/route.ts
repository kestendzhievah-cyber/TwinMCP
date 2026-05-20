import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/auth";
import { badRequest, jsonError, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { audit, auditCtxFromRequest } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

function rateLimited(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return jsonError(
    429,
    "Trop d'opérations sur tes clés API. Patiente un instant avant de réessayer.",
    { retryAfter }
  );
}

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  try {
    const rows = await getDb()
      .select({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        name: apiKeys.name,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, session.userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));
    return NextResponse.json({ keys: rows });
  } catch (err) {
    console.error("[auth/keys GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

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
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const { raw, prefix, hash } = generateApiKey();
    const id = randomUUID();
    await getDb()
      .insert(apiKeys)
      .values({
        id,
        userId: session.userId,
        keyHash: hash,
        prefix,
        name: parsed.data.name ?? null,
      });
    {
      const ctx = auditCtxFromRequest(req);
      audit({
        userId: session.userId,
        action: "api_key.create",
        targetType: "api_key",
        targetId: id,
        ip: ctx.ip,
        metadata: { prefix, name: parsed.data.name ?? null, userAgent: ctx.userAgent },
      });
    }
    return NextResponse.json({ id, key: raw, prefix }, { status: 201 });
  } catch (err) {
    console.error("[auth/keys POST]", err);
    return serverError();
  }
}
