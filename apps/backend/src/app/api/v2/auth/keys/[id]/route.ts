import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  try {
    const result = await getDb()
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.userId)))
      .returning({ id: apiKeys.id });
    if (result.length === 0) return notFound("Key not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/keys DELETE]", err);
    return serverError();
  }
}
