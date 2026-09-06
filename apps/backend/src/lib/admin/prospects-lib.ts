import { type NextRequest, NextResponse } from "next/server";
import { forbidden, unauthorized } from "@/lib/errors";
import { requireSessionUser, type SessionUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

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
