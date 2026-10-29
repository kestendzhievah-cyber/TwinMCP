import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema/core";
import { toolCalls } from "@/db/schema/activity";
import { badRequest, forbidden, serverError } from "@/lib/errors";
import { can, minPlanFor, PLAN_LABELS } from "@/lib/plan-features";
import { requireManagementUser } from "@/lib/session";
import {
  CUSTOMER_ROWS_MAX,
  customersCsvFilename,
  customersToCsv,
  keyIdsToResolve,
  parseCustomerUsageRange,
  toCustomerRows,
  type KeyInfo,
  type RawCustomerGroup,
} from "@/lib/usage/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/usage/customers?from&to&serverId&format=csv
 *
 * Tool calls per end customer (agencies): grouped by the external_user_id of
 * the API key that made them, or by the key itself when it has no label. Owner
 * scope only (every row is filtered on the caller's user id). The window is
 * limited to the plan's activity retention; the response says when `from` was
 * moved up. `format=csv` needs the usage-export capability, as /usage/export.
 */
export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const wantsCsv = url.searchParams.get("format") === "csv";

  try {
    const db = getDb();
    const [userRow] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    const plan = userRow?.plan ?? "free";

    if (wantsCsv && !can(plan, "usageExport")) {
      return forbidden(
        `Exporting usage requires the ${PLAN_LABELS[minPlanFor("usageExport")]} plan.`
      );
    }

    const range = parseCustomerUsageRange(url.searchParams, plan);
    if (!range.ok) return badRequest(range.error);

    const conds = [
      eq(toolCalls.userId, session.userId),
      gte(toolCalls.createdAt, range.from),
      lt(toolCalls.createdAt, range.to),
    ];
    if (range.serverId) conds.push(eq(toolCalls.serverId, range.serverId));

    // Unlabelled calls are grouped per key; labelled ones per customer label.
    const keyGroup = sql<
      string | null
    >`case when ${toolCalls.externalUserId} is null then ${toolCalls.apiKeyId} end`;
    const groups = await db
      .select({
        externalUserId: toolCalls.externalUserId,
        keyGroup,
        apiKeyId: sql<
          string | null
        >`case when count(distinct ${toolCalls.apiKeyId}) = 1 then min(${toolCalls.apiKeyId}) end`,
        keyCount: sql<number>`count(distinct ${toolCalls.apiKeyId})::int`,
        calls: sql<number>`count(*)::int`,
        errors: sql<number>`(count(*) filter (where ${toolCalls.status} <> 'ok'))::int`,
        lastCallAt: sql<string | null>`max(${toolCalls.createdAt})`,
      })
      .from(toolCalls)
      .where(and(...conds))
      .groupBy(toolCalls.externalUserId, keyGroup)
      .orderBy(desc(sql`count(*)`))
      .limit(CUSTOMER_ROWS_MAX + 1);

    const truncated = groups.length > CUSTOMER_ROWS_MAX;
    const raw: RawCustomerGroup[] = groups.slice(0, CUSTOMER_ROWS_MAX);

    const ids = keyIdsToResolve(raw);
    const keys = new Map<string, KeyInfo>();
    if (ids.length > 0) {
      const keyRows = await db
        .select({ id: apiKeys.id, prefix: apiKeys.prefix, name: apiKeys.name })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, session.userId), inArray(apiKeys.id, ids)));
      for (const k of keyRows) keys.set(k.id, { prefix: k.prefix, name: k.name ?? null });
    }

    const rows = toCustomerRows(raw, keys);

    if (wantsCsv) {
      return new NextResponse(customersToCsv(rows), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${customersCsvFilename(range.from, range.to)}"`,
          "cache-control": "no-store",
        },
      });
    }

    return NextResponse.json({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      retentionDays: range.retentionDays,
      clamped: range.clamped,
      serverId: range.serverId,
      usageExport: can(plan, "usageExport"),
      truncated,
      rows,
    });
  } catch (err) {
    console.error("[usage/customers]", err);
    return serverError();
  }
}
