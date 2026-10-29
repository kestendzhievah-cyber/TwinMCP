// What happens right after Supabase hands us a session: /auth/callback (PKCE
// code exchange: OAuth, magic link, same-browser email confirmation) and
// /auth/confirm (token_hash verification: email confirmation opened on another
// device or browser) both end here.
//
// "Is this the account's first authenticated session?" is a DB fact, not a
// clock heuristic: the users row is created with INSERT … ON CONFLICT DO
// NOTHING RETURNING id, so exactly one request ever gets the row back. Only
// that request fires signup_completed, the session.signup audit and the
// welcome email; every other one is a sign-in.
//
// Server-only (database, Stripe-free).

import * as Sentry from "@sentry/nextjs";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { trackServer } from "@/lib/analytics/server";
import { audit } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";
import { attributionMetadata } from "@/lib/billing/checkout-helpers";
import type { PostAuthState } from "@/lib/auth/return-to";

// The pure, client-safe helpers live in lib/auth/return-to.ts (the auth forms
// import them too); re-exported so the routes keep one import site.
export {
  DEFAULT_RETURN_TO,
  safeReturnTo,
  normalizeCadence,
  normalizePromo,
  readProIntent,
  readFreeIntent,
  proIntentQuery,
  checkoutStartPath,
  postAuthRedirect,
} from "@/lib/auth/return-to";
import { trustedClientIp } from "@/lib/net/client-ip";
export type { IntentCadence, ProIntent, PostAuthState } from "@/lib/auth/return-to";

const PLACEHOLDER_DOMAIN = "@placeholder.twinmcp.fr";

// Subscribed = never send to a new checkout (lib/billing/checkout.ts would
// answer with the Customer Portal anyway).
const SUBSCRIBED_STATUSES = new Set(["active", "trialing", "past_due"]);

export function inferAuthMethod(provider: string | undefined): "oauth" | "password" | "magic-link" {
  if (!provider || provider === "email") return "password";
  return "oauth";
}

export interface CompletePostAuthInput {
  user: User;
  locale?: "en" | "fr";
  /** Overrides user.user_metadata.attribution (recorded by the sign-up form). */
  attribution?: Record<string, unknown> | null;
  /** For the audit row's IP / user agent. */
  request?: Request;
}

function requestContext(req: Request | undefined) {
  if (!req) return { ip: null as string | null, userAgent: null as string | null };
  return {
    ip: trustedClientIp(req),
    userAgent: req.headers.get("user-agent"),
  };
}

export async function completePostAuth(input: CompletePostAuthInput): Promise<PostAuthState> {
  const { user } = input;
  const db = getDb();
  const realEmail = user.email && !user.email.endsWith(PLACEHOLDER_DOMAIN) ? user.email : null;

  const metadataAttribution = (user.user_metadata as Record<string, unknown> | undefined)
    ?.attribution as Record<string, unknown> | undefined;
  const attribution = attributionMetadata(input.attribution ?? metadataAttribution ?? null);
  const hasAttribution = Object.keys(attribution).length > 0;

  let firstSession = false;
  try {
    // No conflict target: a clash on the primary key OR on the unique email
    // index both mean "not a new account" and must not throw.
    const inserted = await db
      .insert(users)
      .values({
        id: user.id,
        email: realEmail ?? `${user.id}${PLACEHOLDER_DOMAIN}`,
        ...(hasAttribution ? { metadata: { attribution } } : {}),
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    firstSession = inserted.length > 0;

    // Existing row: backfill a missing address (older OAuth sign-ups were
    // stored with an empty or placeholder email). Never overwrite a real one.
    if (!firstSession && realEmail) {
      await db
        .update(users)
        .set({ email: realEmail, updatedAt: new Date() })
        .where(
          and(
            eq(users.id, user.id),
            or(
              eq(users.email, ""),
              isNull(users.email),
              sql`${users.email} LIKE ${`%${PLACEHOLDER_DOMAIN}`}`
            )
          )
        )
        .catch((err) => {
          // A unique-email clash with another row: keep the placeholder.
          console.warn("[post-auth] email backfill skipped:", err);
        });
    }
  } catch (err) {
    console.error("[post-auth] users upsert failed:", err);
    Sentry.captureException(err, { tags: { area: "auth", stage: "post-auth" } });
  }

  const provider = (user.app_metadata?.provider as string | undefined) ?? undefined;
  const method = inferAuthMethod(provider);
  const ctx = requestContext(input.request);
  const locale =
    input.locale ??
    (attribution.locale === "fr" || attribution.locale === "en"
      ? (attribution.locale as "en" | "fr")
      : undefined);

  if (firstSession) {
    trackServer({
      event: "signup_completed",
      distinctId: user.id,
      properties: {
        via: "server",
        method,
        provider: provider ?? null,
        ...(locale ? { locale } : {}),
        ...attribution,
      },
    });
    audit({
      userId: user.id,
      action: "session.signup",
      targetType: provider && provider !== "email" ? "oauth_provider" : "none",
      targetId: provider ?? null,
      ip: ctx.ip,
      metadata: { method, userAgent: ctx.userAgent, ...(locale ? { locale } : {}) },
    });
    if (realEmail) {
      // Fire-and-forget: Resend may be unconfigured. Never block the redirect
      // on a lifecycle email.
      sendWelcomeEmail(realEmail).catch((err) => {
        console.warn("[post-auth] welcome email failed:", err);
      });
    }
  } else {
    audit({
      userId: user.id,
      action: "session.signin",
      targetType: provider && provider !== "email" ? "oauth_provider" : "none",
      targetId: provider ?? null,
      ip: ctx.ip,
      metadata: { method, userAgent: ctx.userAgent },
    });
  }

  let onboardingCompleted: boolean | null = null;
  let subscribed = false;
  try {
    const [row] = await db
      .select({
        completedAt: users.onboardingCompletedAt,
        subscriptionStatus: users.subscriptionStatus,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (row) {
      onboardingCompleted = Boolean(row.completedAt);
      subscribed =
        Boolean(row.stripeSubscriptionId) && SUBSCRIBED_STATUSES.has(row.subscriptionStatus ?? "");
    }
  } catch (err) {
    console.error("[post-auth] state lookup failed:", err);
  }

  return { firstSession, onboardingCompleted, subscribed };
}
