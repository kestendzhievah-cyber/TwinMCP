import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RETURN_TO = "/dashboard";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnTo = url.searchParams.get("returnTo") ?? DEFAULT_RETURN_TO;

  let userId: string | undefined;
  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    userId = data?.user?.id;
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
