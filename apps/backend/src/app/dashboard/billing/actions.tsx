"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, CheckCircle2, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PLAN_CAPABILITIES, PRO_TRIAL_DAYS } from "@/lib/plan-features";
import { track } from "@/lib/analytics/funnel";
import { normalizePromo } from "@/lib/auth/return-to";
import {
  isCheckoutErrorReason,
  isCheckoutFrom,
  type CheckoutErrorReason,
  type CheckoutFrom,
} from "@/lib/billing/checkout-helpers";

interface Props {
  plan: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
  hasStripeCustomer: boolean;
  /** The Pro daily tool-call quota actually enforced (lib/rate-limit.ts, env-overridable). */
  proDailyLimit: number;
}

type Cadence = "monthly" | "yearly";

// Fixed copy per checkout/start failure code (never server text from the URL).
const CHECKOUT_ERROR_COPY: Record<CheckoutErrorReason, string> = {
  price: "Pro checkout is not available right now. Please contact support.",
  stripe: "Could not reach our payment provider. Please try again in a moment.",
  unknown: "Could not start checkout. Please try again.",
};

// What Pro includes — the one paid plan. Every line is enforced by the code
// (lib/plan-features.ts PLAN_CAPABILITIES.pro, lib/rate-limit.ts daily quota —
// passed in from the server so this card always shows the enforced figure);
// keep it in sync with the marketing bullets in components/pricing/pricing-data.ts.
const PRO = PLAN_CAPABILITIES.pro;
function proBullets(dailyLimit: number): string[] {
  return [
    `${PRO.servers} servers`,
    `All box sizes (${PRO.boxSizes.join(", ")})`,
    `${dailyLimit.toLocaleString("en-US")} tool calls / day`,
    "Publish your own MCPs",
    `${PRO.apiKeys} API keys`,
    `Audit logs · ${PRO.auditRetentionDays} days`,
    "Usage export",
    "Priority email support",
  ];
}

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Deterministic (server === client) to avoid a hydration mismatch.
  return formatDate(d);
}

export function BillingActions({
  plan,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  subscriptionStatus,
  hasStripeCustomer,
  proDailyLimit,
}: Props) {
  const proFeatures = proBullets(proDailyLimit);
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState("");
  // A Pro intent on the URL (sign-up / sign-in with plan=pro) picks the cadence
  // the visitor chose; otherwise default to yearly, the best-value view.
  const [cadence, setCadence] = useState<Cadence>(() => {
    const c = params.get("cadence");
    if (c === "monthly") return "monthly";
    return "yearly";
  });
  const [banner, setBanner] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);
  // The free month is for a first subscription only (lib/billing/checkout.ts).
  const trialEligible = !hasStripeCustomer;

  // Surface the checkout outcome from the Stripe redirect, then strip the query
  // so a refresh doesn't re-trigger it. Runs once on mount: reading `status` here
  // and depending on `params` would tear the poll down the instant router.replace
  // strips the query (params changes → effect cleanup fires before the first
  // tick), which is exactly the bug that left the plan not auto-updating.
  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      setBanner({
        type: "success",
        message: "Checkout complete. Your Pro plan is activating; this page updates automatically.",
      });
      router.replace("/dashboard/billing");
      // The plan flips when Stripe's webhook lands (usually a few seconds). Poll
      // so the page self-updates instead of asking the user to refresh manually.
      let n = 0;
      const poll = setInterval(() => {
        router.refresh();
        if (++n >= 6) clearInterval(poll);
      }, 2500);
      return () => clearInterval(poll);
    } else if (status === "canceled") {
      track({ name: "checkout_canceled", properties: { from: "billing" } });
      setBanner({
        type: "info",
        message:
          plan === "free" && trialEligible
            ? "Checkout canceled. You were not charged. Your free month is still available."
            : "Checkout canceled. You were not charged.",
      });
      router.replace("/dashboard/billing");
    } else if (params.get("checkout") === "error") {
      // GET /api/v2/billing/checkout/start could not open Stripe. Only a fixed
      // reason code is read: any free-text `message` param is ignored, so a
      // crafted link cannot put its own words inside this trusted banner.
      const reason = params.get("reason");
      setBanner({
        type: "error",
        message: isCheckoutErrorReason(reason)
          ? CHECKOUT_ERROR_COPY[reason]
          : CHECKOUT_ERROR_COPY.unknown,
      });
      router.replace("/dashboard/billing");
    }
    // Mount-only on purpose: reading `params`/`router` here must NOT re-run this
    // effect, or router.replace (which changes params) would tear down the poll.
  }, []);

  // plan=pro on the URL: the visitor asked for Pro before signing in (pricing
  // page, sign-up, sign-in). A Free account goes straight to the checkout, once;
  // the ref survives React's dev double-invoke and a re-render.
  const autoCheckoutStarted = useRef(false);
  useEffect(() => {
    if (autoCheckoutStarted.current) return;
    const intent = params.get("plan");
    if (intent !== "pro" && intent !== "team") return;
    autoCheckoutStarted.current = true;
    if (plan !== "free") {
      // Already on a paid plan: nothing to buy, just drop the intent.
      router.replace("/dashboard/billing");
      return;
    }
    const c: Cadence =
      params.get("cadence") === "yearly" || params.get("cadence") === "annual"
        ? "yearly"
        : "monthly";
    const promo = normalizePromo(params.get("promo"));
    // The surface that asked for Pro (sign-up confirmation bounced here by
    // checkout/start): keeps Stripe's return URLs pointing at onboarding.
    const fromParam = params.get("from");
    const from: CheckoutFrom = isCheckoutFrom(fromParam) ? fromParam : "billing";
    // Drop the intent from the history entry first, so the browser's Back
    // button from Stripe lands on a plain Billing page instead of reopening
    // the checkout.
    window.history.replaceState(null, "", "/dashboard/billing");
    setCadence(c);
    setBanner({ type: "info", message: "Opening secure checkout…" });
    void checkout({
      cadence: c,
      from,
      ...(promo?.startsWith("promo_")
        ? { promotionCodeId: promo }
        : promo
          ? { creatorSlug: promo }
          : {}),
    });
    // Mount-only, like the status effect above.
  }, []);

  // Pro is the only plan sold; Team subscribers are grandfathered and manage
  // their subscription from the billing portal below.
  async function checkout(
    opts: {
      cadence?: Cadence;
      promotionCodeId?: string;
      creatorSlug?: string;
      from?: CheckoutFrom;
    } = {}
  ) {
    const chosen = opts.cadence ?? cadence;
    setLoading("pro");
    // Same funnel step the marketing pricing page fires (lib/analytics/funnel.ts).
    track({
      name: "checkout_started",
      properties: {
        plan: "pro",
        cadence: chosen === "yearly" ? "annual" : "monthly",
        ...(opts.creatorSlug ? { creatorSlug: opts.creatorSlug } : {}),
      },
    });
    try {
      const res = await fetch("/api/v2/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: "pro",
          cadence: chosen,
          from: opts.from ?? "billing",
          ...(opts.promotionCodeId ? { promotionCodeId: opts.promotionCodeId } : {}),
          ...(opts.creatorSlug ? { creatorSlug: opts.creatorSlug } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setBanner({ type: "error", message: data.message ?? "Could not start checkout. Try again." });
    } catch {
      setBanner({ type: "error", message: "Network error — try again." });
    }
    setLoading("");
  }

  async function openPortal() {
    setLoading("portal");
    track({ name: "portal_opened" });
    try {
      const res = await fetch("/api/v2/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setBanner({ type: "error", message: data.message ?? "Could not open the billing portal." });
    } catch {
      setBanner({ type: "error", message: "Network error — try again." });
    }
    setLoading("");
  }

  const periodLabel = formatPeriodEnd(currentPeriodEnd);

  return (
    <div className="space-y-8">
      {/* Checkout outcome: a tinted memo line (DESIGN.md §5 callouts). */}
      {banner && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 border border-l-2 px-4 py-3 text-sm",
            banner.type === "success"
              ? "border-success/40 border-l-success bg-success/10 text-success"
              : banner.type === "error"
                ? "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive"
                : "border-info/40 border-l-info bg-info/10 text-info"
          )}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : banner.type === "error" ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {/* Subscription memo: one ruled line about the next date, tinted when it needs attention. */}
      {plan !== "free" &&
        periodLabel &&
        (cancelAtPeriodEnd ? (
          <div className="border border-border border-l-2 border-l-warning bg-card px-4 py-3 text-sm">
            Your subscription{" "}
            <Badge variant="warning" className="align-middle">
              cancels
            </Badge>{" "}
            on <span className="lining font-medium">{periodLabel}</span>. You keep access until
            then.
          </div>
        ) : subscriptionStatus === "past_due" || subscriptionStatus === "unpaid" ? (
          <div className="border border-border border-l-2 border-l-destructive bg-card px-4 py-3 text-sm">
            <Badge variant="destructive" className="mr-1 align-middle">
              Payment due
            </Badge>{" "}
            The last renewal could not be charged. Update your payment method from the billing
            portal.
          </div>
        ) : subscriptionStatus === "trialing" ? (
          // The free month: Stripe's current_period_end is the trial end, so
          // the first charge lands on that date. The cadence chosen at checkout
          // is not mirrored on the user row, hence no amount here.
          <div className="border border-border border-l-2 border-l-info bg-card px-4 py-3 text-sm">
            <Badge variant="info" className="mr-1 align-middle">
              Free month
            </Badge>{" "}
            in progress — your first charge is on{" "}
            <span className="lining font-medium">{periodLabel}</span>. Cancel anytime before then
            from the billing portal.
          </div>
        ) : (
          <div className="border border-border bg-card px-4 py-3 text-sm">
            Next charge on <span className="lining font-medium">{periodLabel}</span>.
          </div>
        ))}

      {plan === "free" && (
        <div className="space-y-8">
          <div className="space-y-5">
            {/* Eyebrow with rules (DESIGN.md §4.7) over the cadence stamps. */}
            <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
              Upgrade to Pro
            </p>
            <CadenceToggle
              cadence={cadence}
              onChange={(c) => {
                if (c !== cadence) {
                  track({
                    name: "cadence_toggled",
                    properties: { cadence: c, surface: "billing" },
                  });
                }
                setCadence(c);
              }}
            />
          </div>
          <div className="mx-auto max-w-md">
            <PlanUpgradeCard
              name="Pro"
              description="Everything we offer, for developers shipping with AI every day."
              bullets={proFeatures}
              monthly={14.99}
              yearly={135}
              trialDays={trialEligible ? PRO_TRIAL_DAYS : 0}
              highlighted
              cadence={cadence}
              onCheckout={() => void checkout()}
              loading={loading === "pro"}
              disabled={!!loading}
            />
          </div>
        </div>
      )}

      {plan !== "free" && (
        <div className={cn("grid gap-6", plan === "pro" && "md:grid-cols-2")}>
          <Card className={cn(plan !== "pro" && "max-w-xl")}>
            <CardHeader>
              <CardTitle>Manage subscription</CardTitle>
              <CardDescription>
                Update your payment method, view invoices, or cancel — all from the billing portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="secondary"
                onClick={openPortal}
                disabled={!!loading || !hasStripeCustomer}
              >
                {loading === "portal" ? "Redirecting…" : "Billing portal"}
              </Button>
              {!hasStripeCustomer && (
                <p className="text-xs italic text-muted-foreground">
                  Available once you have a subscription. If your plan was set up manually, contact
                  support to manage it.
                </p>
              )}
            </CardContent>
          </Card>
          {plan === "pro" && (
            <Card>
              <CardHeader>
                <CardTitle>Included in Pro</CardTitle>
                <CardDescription>What your plan unlocks on your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <PlanBullets bullets={proFeatures} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// The pricing-tier check list (DESIGN.md §5): success check marks, lining figures.
function PlanBullets({ bullets }: { bullets: readonly string[] }) {
  return (
    <ul className="lining space-y-2 text-sm">
      {bullets.map((b) => (
        <li key={b} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// Self-serve plan card (Pro — the only plan sold). The annual view is deliberately
// loud on the `highlighted` plan (the stacked-card lift, the gilt seal, savings
// called out) to steer toward the yearly commitment. Prices are display strings —
// the actual charge is the Stripe price STRIPE_<PLAN>_*_PRICE_ID points to. Keep in sync.
function PlanUpgradeCard({
  name,
  description,
  bullets,
  monthly,
  yearly,
  trialDays = 0,
  highlighted = false,
  cadence,
  onCheckout,
  loading,
  disabled,
}: {
  name: string;
  description: string;
  bullets: readonly string[];
  monthly: number;
  yearly: number;
  /** Free days on a first subscription (0 = not eligible). */
  trialDays?: number;
  highlighted?: boolean;
  cadence: Cadence;
  onCheckout: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const isYearly = cadence === "yearly";
  const fullYear = monthly * 12;
  const savings = Math.round(fullYear - yearly);
  const effMonthly = yearly / 12;
  const savingsPct = Math.round((1 - yearly / fullYear) * 100);
  const loud = highlighted && isYearly;
  const eur = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;
  return (
    // The highlighted tier is the pricing recipe (DESIGN.md §5): ink hairline,
    // stacked-card shadow, one gilt seal in the top-left corner.
    <Card className={cn("relative", loud && "border-foreground/70 shadow-stack")}>
      {loud && (
        <Badge variant="gilt" className="absolute -top-3 left-6">
          Best value
        </Badge>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isYearly ? (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="lining text-4xl font-medium">{eur(yearly)}</span>
              <span className="text-sm italic text-muted-foreground">/ year</span>
            </div>
            <p className="lining mt-1.5 text-sm text-muted-foreground">
              <span className="line-through">{eur(fullYear)}</span> · {eur(effMonthly)}/mo billed
              annually · <span className="font-medium text-success">save €{savings}/yr</span>
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="lining text-4xl font-medium">{eur(monthly)}</span>
              <span className="text-sm italic text-muted-foreground">/ month</span>
            </div>
            <p className="lining mt-1.5 text-sm font-medium text-success">
              Switch to yearly and save {savingsPct}% (€{savings}/yr)
            </p>
          </div>
        )}
        {trialDays > 0 && (
          <p className="lining text-sm font-medium text-success">
            Your first month is free · card required · cancel anytime during the trial
          </p>
        )}
        <PlanBullets bullets={bullets} />
        <Button onClick={onCheckout} disabled={disabled} className="w-full">
          {loading
            ? "Redirecting…"
            : trialDays > 0
              ? `Start my free month of ${name}`
              : isYearly
                ? `Get ${name} — yearly`
                : `Upgrade to ${name}`}
        </Button>
      </CardContent>
    </Card>
  );
}

function CadenceToggle({
  cadence,
  onChange,
}: {
  cadence: Cadence;
  onChange: (c: Cadence) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Two hairline stamps side by side; the chosen cadence is pressed in ink. No pill (DESIGN.md §3). */}
      <div
        role="group"
        aria-label="Billing cadence"
        className="inline-flex divide-x divide-border border border-border bg-card"
      >
        <button
          type="button"
          onClick={() => onChange("monthly")}
          aria-pressed={cadence === "monthly"}
          className={cn(
            "smallcaps tracking-sc h-10 px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-px",
            cadence === "monthly"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("yearly")}
          aria-pressed={cadence === "yearly"}
          className={cn(
            "smallcaps tracking-sc h-10 px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-px",
            cadence === "yearly"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Yearly
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs italic text-muted-foreground">
        <Badge variant="success" className="lining not-italic">
          Save up to 25%
        </Badge>
        <span>
          Pay yearly — like getting{" "}
          <span className="font-medium not-italic text-success">up to 3 months free</span>
        </span>
      </div>
    </div>
  );
}
