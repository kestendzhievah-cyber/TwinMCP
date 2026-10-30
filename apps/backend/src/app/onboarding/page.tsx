import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers, users } from "@/db/schema";
import { creditLedger } from "@/db/schema/wallet";
import { OnboardingWizard } from "./wizard";
import type { SignupCreditView } from "@/components/onboarding/step-welcome";
import { formatCredit } from "@/lib/billing/upgrade-state";
import { getWallet } from "@/lib/wallet/ledger";
import {
  SIGNUP_CREDIT_GRACE_MS,
  grantSignupCredit,
  isEmailConfirmed,
} from "@/lib/wallet/signup-credit";
import { notifyWalletState } from "@/lib/wallet/notify";
import { pickClientIp } from "@/lib/net/client-ip";
import { SignupConversion, SubscriptionConversion } from "@/components/analytics/ads-conversion";
import { getCheckoutConversion } from "@/lib/billing/checkout-conversion";
import { ONBOARDING_SLUGS, hasRequiredConfig, onboardingRank } from "@/lib/mcp/onboarding-catalog";
import { IDE_LABELS, type IdeKey } from "@/lib/mcp/client-config";

// New accounts land here right after confirming their email (auth/callback).
// Only count accounts created recently, so a returning user is never counted.
const SIGNUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Steps (0-3): IDE, Server, MCP, Connect. The Plan step is gone with the
// subscription: every new account starts on its free sign-up credit.
const LAST_STEP = 3;
const SERVER_STEP = 1;

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  searchParams: Promise<{
    force?: string;
    /**
     * Wizard step to open on, in the numbering links still use (1 IDE,
     * 2 server, 3 MCP, 4 connect; the dashboard checklist links to step 2).
     */
    step?: string;
    /** "success" when Stripe sends a legacy Pro checkout back here. */
    status?: string;
    session_id?: string;
  }>;
}

function isIdeKey(value: unknown): value is IdeKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(IDE_LABELS, value);
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const force = params.force === "1";
  const checkoutDone = params.status === "success";
  const sessionId = params.session_id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?returnTo=/onboarding");

  const db = getDb();

  // Ensure the row exists (matches lib/session ensureUserRow behaviour).
  await db
    .insert(users)
    .values({ id: user.id, email: user.email ?? `${user.id}@placeholder.twinmcp.fr` })
    .onConflictDoNothing({ target: users.id });

  const [me] = await db
    .select({
      completedAt: users.onboardingCompletedAt,
      metadata: users.metadata,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (me?.completedAt && !force) {
    // A checkout started here after onboarding was done (rare) still has to
    // reach a page that reports the Google Ads conversion: the billing page.
    if (checkoutDone && sessionId) {
      redirect(
        `/dashboard/billing?topup=success&session_id=${encodeURIComponent(sessionId)}` as Route
      );
    }
    redirect("/dashboard");
  }

  // Step 3 offers only zero-config box MCPs from the curated list, in its
  // order: no API key, no local agent, so the first tool call can happen in
  // the next five minutes. A slug missing from the DB simply drops out.
  const catalogRows = await db
    .select({
      id: mcpServers.id,
      slug: mcpServers.slug,
      name: mcpServers.name,
      description: mcpServers.description,
      runtime: mcpServers.runtime,
      version: mcpServers.version,
      configSchema: mcpServers.configSchema,
    })
    .from(mcpServers)
    .where(
      and(
        inArray(mcpServers.slug, [...ONBOARDING_SLUGS]),
        eq(mcpServers.hostMode, "box"),
        eq(mcpServers.isPublic, true)
      )
    );
  const catalog = catalogRows
    .filter((mcp) => !hasRequiredConfig(mcp.configSchema))
    .sort((a, b) => onboardingRank(a.slug) - onboardingRank(b.slug));

  // Detect existing server (Free quota = 1) so step 2 can skip ahead.
  const [existing] = await db
    .select({
      id: servers.id,
      name: servers.name,
      slug: servers.slug,
      endpointUrl: servers.endpointUrl,
      status: servers.status,
    })
    .from(servers)
    .where(
      and(
        eq(servers.userId, user.id),
        eq(servers.hostType, "upstash_box"),
        or(eq(servers.status, "running"), eq(servers.status, "provisioning"))
      )
    )
    .orderBy(desc(servers.createdAt))
    .limit(1);

  const existingServer = existing
    ? {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        endpointUrl: existing.endpointUrl,
      }
    : null;

  // Where the wizard opens: the IDE step, or further when a link asks for it
  // (legacy numbering, see searchParams.step; clamped; past the server step
  // only when there is a server to install on).
  let initialStep = 0;
  if (params.step !== undefined) {
    const n = Number.parseInt(params.step, 10);
    if (Number.isFinite(n)) {
      initialStep = Math.min(Math.max(n - 1, 0), LAST_STEP);
      if (initialStep > SERVER_STEP && !existingServer) initialStep = SERVER_STEP;
    }
  }

  const metadata = (me?.metadata ?? {}) as Record<string, unknown>;
  const initialIde = isIdeKey(metadata.ide_preference) ? metadata.ide_preference : null;

  const createdAt = user.created_at ? Date.parse(user.created_at) : NaN;
  const isNewSignup = Number.isFinite(createdAt) && Date.now() - createdAt < SIGNUP_WINDOW_MS;

  // A legacy Pro checkout started before the wallet may still land here
  // (success_url): verify it server-side before reporting the conversion.
  const conversion =
    checkoutDone && sessionId ? await getCheckoutConversion(sessionId, user.id) : null;

  const credit = await loadSignupCredit(user, isNewSignup);

  return (
    <>
      {isNewSignup && <SignupConversion userId={user.id} email={user.email} />}
      {conversion && <SubscriptionConversion {...conversion} email={user.email} />}
      <OnboardingWizard
        catalog={catalog.map((mcp) => ({
          ...mcp,
          configSchema: (mcp.configSchema ?? {}) as { properties?: Record<string, never> },
        }))}
        existingServer={existingServer}
        initialStep={initialStep}
        credit={credit}
        initialIde={initialIde}
      />
    </>
  );
}

const REFUSAL_COPY: Record<string, string> = {
  duplicate_email: "This email address already received the free credit on another account.",
  disposable_email: "Free credit is not available for disposable email addresses.",
  ip_limit: "Too many accounts were created from your network today, so no free credit was added.",
  daily_cap:
    "Free credit is paused for today because of unusual sign-up volume. Sign in again tomorrow to receive it.",
  unverified: "Confirm your email address to receive the free credit.",
};

type SessionUser = {
  id: string;
  email?: string | null;
  created_at?: string;
  email_confirmed_at?: string | null;
  identities?: Array<{ provider: string; identity_data?: Record<string, unknown> | null }> | null;
};

/**
 * The welcome step's credit line: what the sign-up grant gave, or why it did
 * not. The grant itself runs at sign-in (lib/auth/post-auth.ts); when a young,
 * unfunded account has no grant row yet (the row was created by another path,
 * or the first attempt timed out) it is retried here — the grant is
 * idempotent per user and per email, so this can never credit twice. Best
 * effort: any failure shows nothing rather than blocking onboarding.
 */
async function loadSignupCredit(
  user: SessionUser,
  isNewSignup: boolean
): Promise<SignupCreditView | null> {
  try {
    const db = getDb();
    const [wallet, [grant]] = await Promise.all([
      getWallet(user.id),
      db
        .select({ deltaMicros: creditLedger.deltaMicros })
        .from(creditLedger)
        .where(and(eq(creditLedger.userId, user.id), eq(creditLedger.kind, "signup_credit")))
        .limit(1),
    ]);
    if (grant) {
      return {
        status: "granted",
        amount: formatCredit(Number(grant.deltaMicros), { precise: false }),
        expiresAt: wallet.promoExpiresAt?.toISOString() ?? null,
      };
    }
    if (wallet.funded) return { status: "funded" };

    const createdAt = user.created_at ? Date.parse(user.created_at) : NaN;
    const young = Number.isFinite(createdAt) && Date.now() - createdAt < SIGNUP_CREDIT_GRACE_MS;
    if (!young || !isNewSignup) return null;

    const h = await headers();
    const res = await grantSignupCredit({
      userId: user.id,
      email: user.email ?? null,
      ip: pickClientIp(h.get("x-real-ip"), h.get("x-forwarded-for")),
      emailVerified: isEmailConfirmed(user),
    });
    if (res.granted) {
      void notifyWalletState(user.id, "signup_credit_granted");
      const fresh = await getWallet(user.id);
      return {
        status: "granted",
        amount: formatCredit(fresh.promoMicros, { precise: false }),
        expiresAt: fresh.promoExpiresAt?.toISOString() ?? null,
      };
    }
    if (!res.reason || res.reason === "already_granted") return null;
    return {
      status: "refused",
      reason: res.reason,
      message: REFUSAL_COPY[res.reason] ?? "No free credit could be added to this account.",
    };
  } catch (err) {
    console.warn("[onboarding] signup credit state unavailable:", err);
    return null;
  }
}
