import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateRequest, type AuthedApiKey } from "./auth";
import {
  keyAllowsManagement,
  keyMayManageKeys,
  MANAGEMENT_SCOPE_MESSAGE,
  RETIRING_KEY_MESSAGE,
} from "./auth/key-scope";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export interface SessionUser {
  userId: string;
  email?: string;
  /** Set when the caller authenticated with a (full-access) API key. */
  apiKey?: AuthedApiKey;
}

// Skip the idempotent upsert when we already ran it for this (userId, email)
// recently. Keyed on email too, so the one-time empty→real backfill still fires.
// Per-process (single-container assumption, like the auth cache).
const ensuredCache = new Map<string, number>();
const ENSURE_TTL_MS = 60_000;

async function ensureUserRow(userId: string, email: string | undefined) {
  const key = `${userId}:${email ?? ""}`;
  const now = Date.now();
  const exp = ensuredCache.get(key);
  if (exp && exp > now) return;

  await getDb()
    .insert(users)
    .values({ id: userId, email: email ?? `${userId}@placeholder.twinmcp.fr` })
    .onConflictDoUpdate({
      target: users.id,
      // Backfill the email if an earlier insert (e.g. the OAuth callback) left it
      // empty. Only write a real address — never overwrite an existing email and
      // never replace it with the synthetic placeholder.
      set: {
        email: sql`CASE
          WHEN (${users.email} = '' OR ${users.email} IS NULL)
            AND excluded.email NOT LIKE '%@placeholder.twinmcp.fr'
          THEN excluded.email
          ELSE ${users.email}
        END`,
      },
    });

  if (ensuredCache.size > 5000) ensuredCache.clear(); // cheap unbounded-growth guard
  ensuredCache.set(key, now + ENSURE_TTL_MS);
}

type Resolved =
  | { kind: "user"; user: SessionUser }
  | { kind: "scope_denied" } // an mcp_proxy key on a management route
  | { kind: "anonymous" };

/**
 * Every management route (servers, keys, billing, account…) authenticates
 * through here. Scope rule (contract K1): only a `full` API key may act as the
 * account; an `mcp_proxy` key — the one pasted into IDE configs — resolves to
 * no user at all, so no management route can let it through.
 */
export async function requireSessionUser(req: Request): Promise<SessionUser | null> {
  const r = await resolveSession(req);
  return r.kind === "user" ? r.user : null;
}

/**
 * requireSessionUser plus a ready-to-return error: 401 when nobody is signed
 * in, 403 with an explicit message when the caller used an MCP-proxy-only key.
 * Prefer it in route handlers (`if (s instanceof NextResponse) return s;`).
 */
export async function requireManagementUser(
  req: Request,
  unauthenticatedMessage = "Sign in required"
): Promise<SessionUser | NextResponse> {
  const r = await resolveSession(req);
  if (r.kind === "user") return r.user;
  if (r.kind === "scope_denied") {
    return NextResponse.json(
      { message: MANAGEMENT_SCOPE_MESSAGE, code: "key_scope" },
      { status: 403 }
    );
  }
  return NextResponse.json({ message: unauthenticatedMessage }, { status: 401 });
}

/**
 * requireManagementUser for the key-management routes (create, rotate,
 * revoke): additionally refuses a full key that is being retired (it has an
 * expiry, e.g. inside its rotation overlap), so a leaked old key cannot mint
 * a permanent replacement or revoke its successor before it dies.
 */
export async function requireKeyManager(req: Request): Promise<SessionUser | NextResponse> {
  const s = await requireManagementUser(req);
  if (s instanceof NextResponse) return s;
  if (s.apiKey && !keyMayManageKeys(s.apiKey)) {
    return NextResponse.json(
      { message: RETIRING_KEY_MESSAGE, code: "key_retiring" },
      { status: 403 }
    );
  }
  return s;
}

/**
 * Money-moving actions (top-ups, auto-recharge settings, admin credit grants)
 * must come from a signed-in human, never from a bearer API key: a leaked key
 * would otherwise mint credit or charge a saved card off-session. Returns a
 * ready-to-return 403 for an API-key session, null for a browser session.
 */
export function refuseApiKeySession(
  s: SessionUser,
  message = "Use the dashboard to change billing: API keys cannot move money."
): NextResponse | null {
  if (!s.apiKey) return null;
  return NextResponse.json({ message, code: "api_key_not_allowed" }, { status: 403 });
}

async function resolveSession(req: Request): Promise<Resolved> {
  // Dev header — requires an explicit opt-in env var. Relying on NODE_ENV
  // was risky: a staging deploy mislabeled as "development" would silently
  // accept any user id from a request header.
  const devId = req.headers.get("x-twinmcp-user-id");
  if (
    devId &&
    process.env.TWINMCP_ALLOW_DEV_AUTH === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    // Ensure the row exists so endpoints that UPDATE the user actually
    // persist instead of silently no-op'ing on a missing primary key.
    await ensureUserRow(devId, undefined);
    return { kind: "user", user: { userId: devId } };
  }

  // API key (scripts, CLIs). An invalid key never falls through to the cookie.
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ctx7sk_")) {
    const auth = await authenticateRequest(req);
    if (!auth) return { kind: "anonymous" };
    // authenticateRequest always sets apiKey; treat a missing one as the
    // narrowest scope rather than full access.
    if (!auth.apiKey || !keyAllowsManagement(auth.apiKey)) return { kind: "scope_denied" };
    return { kind: "user", user: { userId: auth.userId, apiKey: auth.apiKey } };
  }

  // Supabase session (dashboard / web)
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await ensureUserRow(user.id, user.email);
      return { kind: "user", user: { userId: user.id, email: user.email } };
    }
  } catch {
    // No Supabase session
  }

  return { kind: "anonymous" };
}
