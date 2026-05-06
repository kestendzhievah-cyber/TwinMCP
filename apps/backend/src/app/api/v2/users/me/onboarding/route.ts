import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idePreferences = ["cursor", "claude-code", "windsurf", "cline", "zed", "other"] as const;

const onboardingPatchSchema = z.object({
  idePreference: z.enum(idePreferences).optional(),
  selectedPlan: z.enum(["free", "pro", "team"]).optional(),
  markCompleted: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

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
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

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
