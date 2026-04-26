import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chunks } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage";
import { embed } from "@/lib/openai";
import { badRequest, notFound, rateLimited, serverError, unauthorized } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHUNKS = 12;
const MAX_CONTEXT_CHARS = 20_000;

export async function GET(req: NextRequest) {
  const start = Date.now();
  const endpoint = "/api/v2/context";

  const auth = await authenticateRequest(req);
  if (!auth) {
    logUsage({ endpoint, latencyMs: Date.now() - start, statusCode: 401 });
    return unauthorized();
  }

  const rl = await checkRateLimit(auth.userId, auth.plan);
  if (!rl.ok) {
    logUsage({
      endpoint,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      latencyMs: Date.now() - start,
      statusCode: 429,
    });
    return rateLimited(true);
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const libraryId = url.searchParams.get("libraryId") ?? "";
  if (!query.trim() || !libraryId.trim()) {
    return badRequest("query and libraryId are required");
  }

  try {
    const vec = await embed(query);
    const vecLit = `[${vec.join(",")}]`;
    const db = getDb();

    const rows = await db
      .select({
        content: chunks.content,
        position: chunks.position,
        distance: sql<number>`${chunks.embedding} <=> ${vecLit}::vector`.as("distance"),
      })
      .from(chunks)
      .where(sql`${chunks.libraryId} = ${libraryId}`)
      .orderBy(sql`${chunks.embedding} <=> ${vecLit}::vector`)
      .limit(MAX_CHUNKS);

    if (rows.length === 0) {
      logUsage({
        endpoint,
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        libraryId,
        latencyMs: Date.now() - start,
        statusCode: 404,
      });
      return notFound(
        "Documentation not found or not finalized for this library. This might have happened because you used an invalid TwinMCP-compatible library ID. To get a valid TwinMCP-compatible library ID, use the 'resolve-library-id' with the package name you wish to retrieve documentation for."
      );
    }

    let text = "";
    for (const r of rows) {
      if (text.length + r.content.length > MAX_CONTEXT_CHARS) break;
      text += r.content + "\n\n----------\n\n";
    }

    logUsage({
      endpoint,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      libraryId,
      latencyMs: Date.now() - start,
      statusCode: 200,
    });

    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[context] error", err);
    logUsage({
      endpoint,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      libraryId,
      latencyMs: Date.now() - start,
      statusCode: 500,
    });
    return serverError();
  }
}
