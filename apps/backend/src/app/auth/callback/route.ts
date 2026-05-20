import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { trackServer } from "@/lib/analytics/server";
import { audit, auditCtxFromRequest } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RETURN_TO = "/dashboard";

// Tolerance to treat created_at ≈ last_sign_in_at as "first authenticated
// session" (Supabase sets both during the same exchange).
const FRESH_SIGNUP_WINDOW_MS = 30_000;

function inferMethod(provider: string | undefined): "oauth" | "password" | "magic-link" {
  if (!provider || provider === "email") return "password";
  return "oauth";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnTo = url.searchParams.get("returnTo") ?? DEFAULT_RETURN_TO;

  let userId: string | undefined;
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const u = data?.user;
    userId = u?.id;

    // Fire signup_completed once per user, server-side. Client-side signup
    // form fires its own copy with via:"client" — we tag this one with
    // via:"server" so PostHog can dedupe in the funnel.
    if (u?.id && u.created_at && u.last_sign_in_at) {
      const created = Date.parse(u.created_at);
      const lastSignIn = Date.parse(u.last_sign_in_at);
      const ctx = auditCtxFromRequest(req);
      const provider = u.app_metadata?.provider ?? null;
      const method = inferMethod(u.app_metadata?.provider);

      const isFreshSignup =
        Number.isFinite(created) &&
        Number.isFinite(lastSignIn) &&
        Math.abs(lastSignIn - created) < FRESH_SIGNUP_WINDOW_MS;

      if (isFreshSignup) {
        trackServer({
          event: "signup_completed",
          distinctId: u.id,
          properties: { method, via: "server", provider },
        });
        audit({
          userId: u.id,
          action: "session.signup",
          target: provider,
          ...ctx,
          metadata: { method },
        });
      } else {
        audit({
          userId: u.id,
          action: "session.signin",
          target: provider,
          ...ctx,
          metadata: { method },
        });
      }
    }
  }

  // Send unfinished users through onboarding the first time they hit the
  // post-auth redirect. Any explicit returnTo other than the default is
  // honoured (e.g. password reset → /reset-password).
  if (userId && returnTo === DEFAULT_RETURN_TO) {
    try {
      await getDb()
        .insert(users)
        .values({ id: userId, email: "" })
        .onConflictDoNothing({ target: users.id });

      const [row] = await getDb()
        .select({ completedAt: users.onboardingCompletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!row?.completedAt) {
        return NextResponse.redirect(new URL("/onboarding", url.origin));
      }
    } catch (err) {
      console.error("[auth callback] onboarding lookup failed:", err);
      // Fall through to the default redirect rather than blocking the user.
    }
  }

  return NextResponse.redirect(new URL(returnTo, url.origin));
}
