// Client-safe auth redirect helpers: no database, Sentry or Stripe imports, so
// the sign-up / sign-in forms (client components) and the auth routes share the
// exact same open-redirect guard and Pro-intent parsing.
//
// lib/auth/post-auth.ts (server-only) re-exports everything here.

export const DEFAULT_RETURN_TO = "/dashboard";

/**
 * Same-origin path only. Anything else (absolute URL, protocol-relative
 * "//host", backslash tricks, `javascript:`, control characters) falls back to
 * the dashboard, so the auth redirects can never be turned into an open
 * redirect or a script URL.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_RETURN_TO;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_RETURN_TO;
  }
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_RETURN_TO;
  // Browsers treat "\" like "/" in URLs: "/\evil" was caught above, but a
  // backslash anywhere can still be normalised into a host by some parsers.
  if (raw.includes("\\")) return DEFAULT_RETURN_TO;
  return raw;
}

export type IntentCadence = "monthly" | "yearly";

/** A paid intent carried through the email round trip in the URL. */
export interface ProIntent {
  cadence: IntentCadence;
  /** Creator landing slug (lib/promos/creators.ts) or a Stripe promo_… id. */
  promo?: string;
}

const PROMO_SLUG = /^[a-z0-9-]{1,64}$/;
const PROMO_ID = /^promo_[A-Za-z0-9]{1,64}$/;

export function normalizeCadence(value: string | null | undefined): IntentCadence {
  return value === "yearly" || value === "annual" ? "yearly" : "monthly";
}

/** A creator slug or a Stripe promotion-code id; anything else is dropped. */
export function normalizePromo(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return PROMO_SLUG.test(value) || PROMO_ID.test(value) ? value : undefined;
}

/**
 * plan=pro (or the retired plan=team, which signs up for Pro) → a Pro intent.
 * Anything else, including plan=free, is no paid intent.
 */
export function readProIntent(params: URLSearchParams): ProIntent | null {
  const plan = params.get("plan");
  if (plan !== "pro" && plan !== "team") return null;
  const promo = normalizePromo(params.get("promo"));
  return { cadence: normalizeCadence(params.get("cadence")), ...(promo ? { promo } : {}) };
}

/**
 * plan=free: the visitor chose Free on the pricing page or the sign-up form.
 * Carried to /onboarding?plan=free so the wizard opens after its Plan step.
 */
export function readFreeIntent(params: URLSearchParams): boolean {
  return params.get("plan") === "free";
}

/** The query string that carries a Pro intent (plan, cadence, promo). */
export function proIntentQuery(intent: ProIntent): string {
  const q = new URLSearchParams({ plan: "pro", cadence: intent.cadence });
  if (intent.promo) q.set("promo", intent.promo);
  return q.toString();
}

/** GET /api/v2/billing/checkout/start for a Pro intent (opens Stripe Checkout). */
export function checkoutStartPath(
  intent: ProIntent,
  from: "signup" | "billing" | "onboarding" | "pricing" = "signup"
): string {
  return `/api/v2/billing/checkout/start?${proIntentQuery(intent)}&from=${from}`;
}

export interface PostAuthState {
  /** True only for the request that created the users row. */
  firstSession: boolean;
  /** null when the lookup failed: callers then keep their default redirect. */
  onboardingCompleted: boolean | null;
  subscribed: boolean;
}

/** The wizard, with the Free choice when the visitor already made it. */
export const ONBOARDING_PATH = "/onboarding";

/**
 * Where a freshly authenticated user goes:
 *   1. a Pro intent and no subscription yet → Stripe Checkout (checkout/start);
 *   2. the default landing and onboarding not finished → the wizard, with
 *      ?plan=free when the visitor chose Free (the wizard then skips its Plan
 *      step; a subscribed account skips it on its own);
 *   3. otherwise the requested page.
 */
export function postAuthRedirect(opts: {
  returnTo: string;
  intent: ProIntent | null;
  state: PostAuthState;
  /** plan=free on the auth link (readFreeIntent). Ignored when a Pro intent is present. */
  freeIntent?: boolean;
}): string {
  if (opts.intent && !opts.state.subscribed) return checkoutStartPath(opts.intent, "signup");
  if (opts.returnTo === DEFAULT_RETURN_TO && opts.state.onboardingCompleted === false) {
    return opts.freeIntent && !opts.intent ? `${ONBOARDING_PATH}?plan=free` : ONBOARDING_PATH;
  }
  return opts.returnTo;
}

// ---- Dashboard → onboarding gate ---------------------------------------------

/**
 * Dashboard paths the onboarding gate never leaves: Billing (checkout start,
 * Stripe success / cancel / portal returns, the Google Ads conversion) and
 * Settings (email preferences, account deletion). /onboarding is outside the
 * dashboard layout, so the gate cannot loop on it; it is listed for safety.
 */
export const ONBOARDING_GATE_EXEMPT_PREFIXES: readonly string[] = [
  ONBOARDING_PATH,
  "/dashboard/billing",
  "/dashboard/settings",
];

export interface OnboardingGateState {
  isAdmin: boolean;
  /** users.onboarding_completed_at is set (finished, or "Skip onboarding" in the wizard). null = lookup failed. */
  onboardingCompleted: boolean | null;
  /** Servers not destroyed. null = lookup failed. */
  serverCount: number | null;
  /** Member of a teamspace: may work on servers a teammate owns. */
  teamMember?: boolean;
}

/**
 * Server half of the gate: a signed-in account that never finished (or
 * skipped) onboarding and has no server yet. Fails open: an unknown state
 * (lookup failed) never redirects. Admins are never gated.
 */
export function needsOnboarding(state: OnboardingGateState): boolean {
  if (state.isAdmin || state.teamMember) return false;
  if (state.onboardingCompleted !== false) return false;
  return state.serverCount === 0;
}

/** Client half of the gate: whether this dashboard path may be redirected to /onboarding. */
export function onboardingGateApplies(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !ONBOARDING_GATE_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
