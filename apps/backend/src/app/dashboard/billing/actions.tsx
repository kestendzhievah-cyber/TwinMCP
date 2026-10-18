"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

interface Props {
  plan: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
  hasStripeCustomer: boolean;
}

type Cadence = "monthly" | "yearly";

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
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState("");
  // Default to yearly so the best-value plan is what visitors see first.
  const [cadence, setCadence] = useState<Cadence>("yearly");
  const [banner, setBanner] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

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
        message: "Payment confirmed! Your plan is activating — this page updates automatically.",
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
      setBanner({ type: "info", message: "Checkout canceled. You were not charged." });
      router.replace("/dashboard/billing");
    }
    // Mount-only on purpose: reading `params`/`router` here must NOT re-run this
    // effect, or router.replace (which changes params) would tear down the poll.
  }, []);

  async function checkout(target: "pro" | "team") {
    setLoading(target);
    try {
      const res = await fetch("/api/v2/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: target, cadence }),
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
              Choose a plan
            </p>
            <CadenceToggle cadence={cadence} onChange={setCadence} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <PlanUpgradeCard
              name="Pro"
              description="1,000 requests/day, publish your own MCPs, priority support."
              monthly={14.99}
              yearly={135}
              highlighted
              cadence={cadence}
              onCheckout={() => checkout("pro")}
              loading={loading === "pro"}
              disabled={!!loading}
            />
            <PlanUpgradeCard
              name="Team"
              description="Unlimited servers, member management, audit logs · 90 days, 99.9% SLA."
              monthly={99}
              yearly={990}
              cadence={cadence}
              onCheckout={() => checkout("team")}
              loading={loading === "team"}
              disabled={!!loading}
            />
          </div>
          <EnterpriseCard />
        </div>
      )}

      {plan !== "free" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Manage subscription</CardTitle>
              <CardDescription>
                Update payment method, switch between Pro and Team, view invoices, or cancel — all
                from the billing portal.
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
          <EnterpriseCard />
        </div>
      )}
    </div>
  );
}

// Self-serve plan card (Pro or Team). The annual view is deliberately loud on
// the `highlighted` plan (the stacked-card lift, the gilt seal, savings called
// out) to steer toward the yearly commitment. Prices are display strings — the
// actual charge is the Stripe price STRIPE_<PLAN>_*_PRICE_ID points to. Keep in sync.
function PlanUpgradeCard({
  name,
  description,
  monthly,
  yearly,
  highlighted = false,
  cadence,
  onCheckout,
  loading,
  disabled,
}: {
  name: string;
  description: string;
  monthly: number;
  yearly: number;
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
        <Button onClick={onCheckout} disabled={disabled} className="w-full">
          {loading ? "Redirecting…" : isYearly ? `Get ${name} — yearly` : `Upgrade to ${name}`}
        </Button>
      </CardContent>
    </Card>
  );
}

function EnterpriseCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enterprise</CardTitle>
        <CardDescription>
          SSO/SAML, private deployment, custom audit retention, and a dedicated Slack channel.
          Custom pricing for your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="secondary">
          <Link href={"/enterprise" as Route}>Talk to sales</Link>
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
