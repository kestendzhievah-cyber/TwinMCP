import { redirect } from "next/navigation";
import type { Route } from "next";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers, users } from "@/db/schema";
import { OnboardingWizard } from "./wizard";
import { SignupConversion, SubscriptionConversion } from "@/components/analytics/ads-conversion";
import { getCheckoutConversion } from "@/lib/billing/checkout-conversion";
import { ONBOARDING_SLUGS, hasRequiredConfig, onboardingRank } from "@/lib/mcp/onboarding-catalog";
import { IDE_LABELS, type IdeKey } from "@/lib/mcp/client-config";

// New accounts land here right after confirming their email (auth/callback).
// Only count accounts created recently, so a returning user is never counted.
const SIGNUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const LAST_STEP = 4;
const SERVER_STEP = 2;
const IDE_STEP = 1;

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  searchParams: Promise<{
    force?: string;
    /** Wizard step to open on (0-4): the dashboard checklist links to step 2. */
    step?: string;
    /** "success" when Stripe sends a new Pro trial back here (lib/billing/checkout.ts). */
    status?: string;
    session_id?: string;
    /** "canceled" when the Pro checkout was abandoned. */
    checkout?: string;
    /** "free" when the visitor chose Free before signing up (lib/auth/return-to.ts). */
    plan?: string;
  }>;
}

/** A Pro subscription that needs no plan choice: the trial or a paid month. */
const DECIDED_PRO_STATUSES = new Set(["trialing", "active"]);

function isIdeKey(value: unknown): value is IdeKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(IDE_LABELS, value);
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const force = params.force === "1";
  const proTrial = params.status === "success";
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
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (me?.completedAt && !force) {
    // A checkout started here after onboarding was done (rare) still has to
    // reach a page that reports the Google Ads conversion: the billing page.
    if (proTrial && sessionId) {
      redirect(
        `/dashboard/billing?status=success&session_id=${encodeURIComponent(sessionId)}` as Route
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

  // A trialing or active Pro subscription has nothing left to choose; nor has
  // a visitor who picked Free before signing up (?plan=free survives the
  // email round trip, lib/auth/return-to.ts postAuthRedirect).
  const subscribedPro =
    (me?.plan === "pro" || me?.plan === "team") &&
    DECIDED_PRO_STATUSES.has(me?.subscriptionStatus ?? "");
  const freeChosen = params.plan === "free" && !subscribedPro;

  // Where the wizard opens. A decided plan (Pro trial, subscribed Pro, Free
  // chosen up front) starts after the Plan step, on the IDE step. An explicit
  // ?step= wins when it goes further (clamped; past the server step only when
  // there is a server to install on).
  let initialStep = proTrial || subscribedPro || freeChosen ? IDE_STEP : 0;
  if (!proTrial && params.step !== undefined) {
    const n = Number.parseInt(params.step, 10);
    if (Number.isFinite(n)) {
      const requested = Math.min(Math.max(n, 0), LAST_STEP);
      initialStep = Math.max(initialStep, requested);
      if (initialStep > SERVER_STEP && !existingServer) initialStep = SERVER_STEP;
    }
  }

  const metadata = (me?.metadata ?? {}) as Record<string, unknown>;
  const initialIde = isIdeKey(metadata.ide_preference) ? metadata.ide_preference : null;

  const createdAt = user.created_at ? Date.parse(user.created_at) : NaN;
  const isNewSignup = Number.isFinite(createdAt) && Date.now() - createdAt < SIGNUP_WINDOW_MS;

  // Stripe returns new trials here (success_url). Verify the session
  // server-side, like the billing page, before reporting the conversion.
  const conversion = proTrial && sessionId ? await getCheckoutConversion(sessionId, user.id) : null;

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
        proTrial={proTrial}
        subscribedPro={subscribedPro && !proTrial}
        checkoutCanceled={params.checkout === "canceled"}
        initialIde={initialIde}
      />
    </>
  );
}
