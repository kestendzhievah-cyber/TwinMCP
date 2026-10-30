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
// It is also where the €10 promotional sign-up credit is granted
// (lib/wallet/signup-credit.ts), once the address is CONFIRMED: email/password
// accounts after the confirmation link, OAuth accounts whose provider verified
// the address. The grant is idempotent and retried on later sign-ins within
// 7 days of account creation (covers an unconfirmed first
// session and a row created elsewhere first), and never blocks the sign-in.
// Accounts older than that window are never credited by a login.
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
import {
  grantSignupCredit,
  isEmailConfirmed,
  shouldClaimSignupCredit,
} from "@/lib/wallet/signup-credit";
import { notifyWalletState } from "@/lib/wallet/notify";
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

// Upper bound on how long the sign-up credit grant may hold the redirect.
const SIGNUP_CREDIT_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

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
  let createdAt: Date | null = null;
  let rowExists = false;
  try {
    const [row] = await db
      .select({
        completedAt: users.onboardingCompletedAt,
        subscriptionStatus: users.subscriptionStatus,
        stripeSubscriptionId: users.stripeSubscriptionId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (row) {
      rowExists = true;
      createdAt = row.createdAt;
      onboardingCompleted = Boolean(row.completedAt);
      subscribed =
        Boolean(row.stripeSubscriptionId) && SUBSCRIBED_STATUSES.has(row.subscriptionStatus ?? "");
    }
  } catch (err) {
    console.error("[post-auth] state lookup failed:", err);
  }

  // €10 promotional sign-up credit. The wallet rows reference users, so only
  // once the row exists. Awaited (bounded) so the dashboard the user lands on
  // already shows the credit, but a failure or a slow database never blocks
  // the sign-in: the next sign-in within the grace window retries.
  if (
    rowExists &&
    shouldClaimSignupCredit({
      firstSession,
      createdAt,
      now: new Date(),
      confirmed: isEmailConfirmed(user),
      realEmail,
    })
  ) {
    try {
      const res = await withTimeout(
        grantSignupCredit({ userId: user.id, email: realEmail, ip: ctx.ip }),
        SIGNUP_CREDIT_TIMEOUT_MS
      );
      if (res.granted) {
        trackServer({
          event: "signup_credit_granted",
          distinctId: user.id,
          properties: { method, provider: provider ?? null },
        });
        notifyWalletState(user.id, "signup_credit_granted").catch((err) => {
          console.warn("[post-auth] signup credit email failed:", err);
        });
      } else if (res.reason && res.reason !== "already_granted") {
        // Refusals (duplicate address, throwaway domain, IP limit…) are an
        // abuse signal worth watching, not an error.
        console.info(`[post-auth] signup credit refused for ${user.id}: ${res.reason}`);
        trackServer({
          event: "signup_credit_refused",
          distinctId: user.id,
          properties: { reason: res.reason, method, provider: provider ?? null },
        });
      }
    } catch (err) {
      console.error("[post-auth] signup credit grant failed:", err);
      Sentry.captureException(err, { tags: { area: "wallet", stage: "signup-credit" } });
    }
  }

  return { firstSession, onboardingCompleted, subscribed };
}
