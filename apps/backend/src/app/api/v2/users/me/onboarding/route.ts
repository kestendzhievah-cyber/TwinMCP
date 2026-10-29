import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { badRequest, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { logAudit, clientIp } from "@/lib/audit/log";
import { IDE_LABELS, type IdeKey } from "@/lib/mcp/client-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The IDE tiles of the onboarding wizard are the clients the config generator
// knows (cursor, claude-desktop, claude-code, vscode, windsurf, cline, zed,
// other); deriving the enum keeps the API and the tiles in step. The choice is
// stored in users.metadata.ide_preference and preselects the server page's
// Connect panel.
const idePreferences = Object.keys(IDE_LABELS) as [IdeKey, ...IdeKey[]];

const onboardingPatchSchema = z.object({
  idePreference: z.enum(idePreferences).optional(),
  selectedPlan: z.enum(["free", "pro", "team"]).optional(),
  markCompleted: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const [row] = await getDb()
      .select({
        completedAt: users.onboardingCompletedAt,
        metadata: users.metadata,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return NextResponse.json({
      completed: row?.completedAt != null,
      completedAt: row?.completedAt ?? null,
      metadata: row?.metadata ?? {},
    });
  } catch (err) {
    console.error("[onboarding GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = onboardingPatchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const db = getDb();
    const patch: Record<string, unknown> = {};
    if (parsed.data.idePreference !== undefined) {
      patch.ide_preference = parsed.data.idePreference;
    }
    if (parsed.data.selectedPlan !== undefined) {
      patch.selected_plan = parsed.data.selectedPlan;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (Object.keys(patch).length > 0) {
      updates.metadata = sql`COALESCE(${users.metadata}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`;
    }
    if (parsed.data.markCompleted) {
      updates.onboardingCompletedAt = new Date();
    }

    await db.update(users).set(updates).where(eq(users.id, session.userId));

    if (parsed.data.markCompleted) {
      logAudit({
        userId: session.userId,
        action: "user.onboarding.complete",
        targetType: "user",
        targetId: session.userId,
        metadata: patch,
        ip: clientIp(req),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding POST]", err);
    return serverError();
  }
}
