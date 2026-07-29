"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

  // Surface checkout outcome from Stripe redirect, then strip the query
  // so a refresh doesn't re-trigger the toast.
  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      setBanner({
        type: "success",
        message:
          "Payment confirmed! Your plan is activating — refresh in a few seconds if nothing shows.",
      });
      router.replace("/dashboard/billing");
    } else if (status === "canceled") {
      setBanner({ type: "info", message: "Checkout canceled. You were not charged." });
      router.replace("/dashboard/billing");
    }
  }, [params, router]);

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
    <div className="space-y-6">
      {banner && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : banner.type === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-muted/50 text-foreground"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {plan !== "free" && periodLabel && (
        <div className="rounded-md border border-border/60 bg-card p-4 text-sm">
          {cancelAtPeriodEnd ? (
            <>
              Your subscription <Badge variant="secondary">cancels</Badge> on{" "}
              <span className="font-medium">{periodLabel}</span>. You keep access until then.
            </>
          ) : subscriptionStatus === "past_due" || subscriptionStatus === "unpaid" ? (
            <>
              <Badge variant="destructive">Payment due</Badge> The last renewal could not be
              charged. Update your payment method from the billing portal.
            </>
          ) : (
            <>
              Next charge on <span className="font-medium">{periodLabel}</span>.
            </>
          )}
        </div>
      )}

      {plan === "free" && (
        <div className="space-y-6">
          <CadenceToggle cadence={cadence} onChange={setCadence} />
          <div className="grid gap-4 md:grid-cols-2">
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
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Manage subscription</CardTitle>
              <CardDescription>
                Update payment method, switch between Pro and Team, view invoices, or cancel — all
                from the billing portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                onClick={openPortal}
                disabled={!!loading || !hasStripeCustomer}
              >
                {loading === "portal" ? "Redirecting…" : "Billing portal"}
              </Button>
            </CardContent>
          </Card>
          <EnterpriseCard />
        </div>
      )}
    </div>
  );
}

// Self-serve plan card (Pro or Team). The annual view is deliberately loud on
// the `highlighted` plan (bigger price, emerald accent, savings called out) to
// steer toward the yearly commitment. Prices are display strings — the actual
// charge is the Stripe price STRIPE_<PLAN>_*_PRICE_ID points to. Keep in sync.
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
    <Card
      className={cn(
        "relative overflow-hidden transition-colors",
        loud && "border-emerald-500/50 shadow-md shadow-emerald-500/10"
      )}
    >
      {loud && (
        <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-xl bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="h-3.5 w-3.5" />
          Best value
        </div>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isYearly ? (
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight",
                  highlighted && "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {eur(yearly)}
              </span>
              <span className="text-sm text-muted-foreground">/ year</span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="line-through">{eur(fullYear)}</span> · {eur(effMonthly)}/mo billed
              annually ·{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                save €{savings}/yr
              </span>
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{eur(monthly)}</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Switch to yearly and save {savingsPct}% (€{savings}/yr)
            </p>
          </div>
        )}
        <Button
          onClick={onCheckout}
          disabled={disabled}
          className={cn("w-full", loud && "bg-emerald-600 text-white hover:bg-emerald-700")}
        >
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
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex rounded-full border border-border/80 bg-card p-1.5 text-base shadow-sm">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={cn(
            "rounded-full px-6 py-2.5 font-medium transition-colors",
            cadence === "monthly"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={cn(
            "flex items-center gap-2 rounded-full px-6 py-2.5 font-medium transition-colors",
            cadence === "yearly"
              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Yearly
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              cadence === "yearly"
                ? "bg-white/25 text-white"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            )}
          >
            Save 25%
          </span>
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Pay yearly — like getting{" "}
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">3 months free</span>
      </p>
    </div>
  );
}
