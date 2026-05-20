import { authenticateRequest } from "./auth";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export interface SessionUser {
  userId: string;
  email?: string;
}

async function ensureUserRow(userId: string, email: string | undefined) {
  await getDb()
    .insert(users)
    .values({ id: userId, email: email ?? `${userId}@placeholder.twinmcp.com` })
    .onConflictDoNothing({ target: users.id });
}

export async function requireSessionUser(req: Request): Promise<SessionUser | null> {
  // Dev header — requires an explicit opt-in env var. Relying on NODE_ENV
  // was risky: a staging deploy mislabeled as "development" would silently
  // accept any user id from a request header.
  const devId = req.headers.get("x-twinmcp-user-id");
  if (devId && process.env.TWINMCP_ALLOW_DEV_AUTH === "1") {
    // Ensure the row exists so endpoints that UPDATE the user actually
    // persist instead of silently no-op'ing on a missing primary key.
    await ensureUserRow(devId, undefined);
    return { userId: devId };
  }

  // API key (MCP clients)
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ctx7sk_")) {
    const auth = await authenticateRequest(req);
    if (auth) return { userId: auth.userId };
    return null;
  }

  // Supabase session (dashboard / web)
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await ensureUserRow(user.id, user.email);
      return { userId: user.id, email: user.email };
    }
  } catch {
    // No Supabase session
  }

  return null;
}
