import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { teamspaceFilters, teamspaces } from "@/db/schema";
import { badRequest, forbidden, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  teamspaceId: z.string().min(1),
  minTrustScore: z.number().min(0).max(10),
  blockedLibraryIds: z.array(z.string()),
});

export async function PUT(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const db = getDb();

    // Tenant isolation: only the teamspace owner may write its policy. Without
    // this, any signed-in user could overwrite another org's library filters.
    const [ts] = await db
      .select({ ownerId: teamspaces.ownerId })
      .from(teamspaces)
      .where(eq(teamspaces.id, parsed.data.teamspaceId))
      .limit(1);
    if (!ts || ts.ownerId !== session.userId) {
      return forbidden("Only the teamspace owner can edit its policy.");
    }

    await db
      .insert(teamspaceFilters)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: teamspaceFilters.teamspaceId,
        set: {
          minTrustScore: parsed.data.minTrustScore,
          blockedLibraryIds: parsed.data.blockedLibraryIds,
        },
      });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[policies PUT]", err);
    return serverError();
  }
}
