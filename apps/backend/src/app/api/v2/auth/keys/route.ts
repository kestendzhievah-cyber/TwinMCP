import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

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
    return NextResponse.json({ id, key: raw, prefix }, { status: 201 });
  } catch (err) {
    console.error("[auth/keys POST]", err);
    return serverError();
  }
}
