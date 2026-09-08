import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { forbidden, unauthorized } from "@/lib/errors";
import { requireSessionUser, type SessionUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { getDb } from "@/db";
import { prospectActivities, type ProspectActivityType } from "@/db/schema";

// Admins only — enforced server-side on every prospects API route (never trust
// the hidden nav link). Returns the session, or a ready-to-return error response.
export async function requireAdmin(req: NextRequest): Promise<SessionUser | NextResponse> {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  if (!isAdminEmail(session.email)) return forbidden("Admins only");
  return session;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// Append one row to a prospect's activity timeline. Best-effort — a logging
// failure must never break the underlying create/update, so callers wrap it.
export async function logActivity(
  prospectId: string,
  type: ProspectActivityType,
  body: string,
  createdBy: string | null
) {
  await getDb().insert(prospectActivities).values({
    id: randomUUID(),
    prospectId,
    type,
    body,
    createdBy,
  });
}
