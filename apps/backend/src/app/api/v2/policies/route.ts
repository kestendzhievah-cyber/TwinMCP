import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { teamspaceFilters } from "@/db/schema";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  teamspaceId: z.string().min(1),
  minTrustScore: z.number().min(0).max(10),
  blockedLibraryIds: z.array(z.string()),
});

export async function PUT(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await getDb()
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
