import { NextResponse, type NextRequest } from "next/server";
import { and, desc, gte, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { libraries, teamspaceFilters, teamspaceMembers } from "@/db/schema";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage";
import { badRequest, rateLimited, serverError, unauthorized } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();
  const endpoint = "/api/v2/libs/search";

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
  const libraryName = url.searchParams.get("libraryName") ?? "";
  if (!libraryName.trim()) return badRequest("libraryName is required");

  try {
    const db = getDb();

    // Resolve teamspace filter (take first teamspace user belongs to, if any)
    const memberRows = await db
      .select({ teamspaceId: teamspaceMembers.teamspaceId })
      .from(teamspaceMembers)
      .where(sql`${teamspaceMembers.userId} = ${auth.userId}`)
      .limit(1);

    let minTrust = 0;
    let blocked: string[] = [];
    let filterApplied = false;
    if (memberRows[0]) {
      const f = await db
        .select()
        .from(teamspaceFilters)
        .where(sql`${teamspaceFilters.teamspaceId} = ${memberRows[0].teamspaceId}`)
        .limit(1);
      if (f[0]) {
        minTrust = f[0].minTrustScore;
        blocked = f[0].blockedLibraryIds;
        filterApplied = minTrust > 0 || blocked.length > 0;
      }
    }

    const conditions = [
      sql`${libraries.title} % ${libraryName} OR ${libraries.title} ILIKE ${"%" + libraryName + "%"}`,
      gte(libraries.trustScore, minTrust),
    ];
    if (blocked.length > 0) conditions.push(notInArray(libraries.id, blocked));

    const results = await db
      .select({
        id: libraries.id,
        title: libraries.title,
        description: libraries.description,
        totalSnippets: libraries.totalSnippets,
        trustScore: libraries.trustScore,
        benchmarkScore: libraries.benchmarkScore,
        versions: libraries.versions,
        source: libraries.sourceUrl,
      })
      .from(libraries)
      .where(and(...conditions))
      .orderBy(
        desc(sql`similarity(${libraries.title}, ${libraryName})`),
        desc(libraries.trustScore)
      )
      .limit(20);

    logUsage({
      endpoint,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      latencyMs: Date.now() - start,
      statusCode: 200,
    });

    return NextResponse.json({
      results,
      searchFilterApplied: filterApplied,
      query,
    });
  } catch (err) {
    console.error("[libs/search] error", err);
    logUsage({
      endpoint,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      latencyMs: Date.now() - start,
      statusCode: 500,
    });
    return serverError();
  }
}
