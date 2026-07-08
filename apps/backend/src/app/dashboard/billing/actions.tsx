"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  plan: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
  hasStripeCustomer: boolean;
}

type Cadence = "monthly" | "yearly";

const PRICE_LABEL: Record<string, Record<Cadence, string>> = {
  pro: { monthly: "$20/mo", yearly: "$16/mo billed yearly" },
  team: { monthly: "$50/mo", yearly: "$40/mo billed yearly" },
};

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
  const [cadence, setCadence] = useState<Cadence>("monthly");
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
        <>
          <CadenceToggle cadence={cadence} onChange={setCadence} />
          <div className="grid gap-4 md:grid-cols-2">
            <PlanCard
              title="Pro"
              description={`${PRICE_LABEL.pro[cadence]} — 1,000 requests/day, priority support`}
              onClick={() => checkout("pro")}
              loading={loading === "pro"}
              disabled={!!loading}
              cta="Upgrade to Pro"
            />
            <PlanCard
              title="Team"
              description={`${PRICE_LABEL.team[cadence]} — 5,000 requests/day, teamspace, policies`}
              onClick={() => checkout("team")}
              loading={loading === "team"}
              disabled={!!loading}
              cta="Upgrade to Team"
            />
          </div>
        </>
      )}

      {plan !== "free" && (
        <div className="grid gap-4 md:grid-cols-2">
          {plan === "pro" && (
            <>
              <CadenceToggle cadence={cadence} onChange={setCadence} />
              <PlanCard
                title="Upgrade to Team"
                description={`${PRICE_LABEL.team[cadence]} — 5,000 requests/day + teamspace management.`}
                onClick={() => checkout("team")}
                loading={loading === "team"}
                disabled={!!loading}
                cta="Upgrade"
              />
            </>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Manage subscription</CardTitle>
              <CardDescription>
                Update payment method, view invoices, or cancel anytime.
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
        </div>
      )}
    </div>
  );
}

function PlanCard({
  title,
  description,
  onClick,
  loading,
  disabled,
  cta,
}: {
  title: string;
  description: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onClick} disabled={disabled}>
          {loading ? "Redirecting…" : cta}
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
    <div className="inline-flex rounded-full border border-border/80 bg-card p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
          cadence === "monthly"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
          cadence === "yearly"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Yearly <span className="text-xs font-normal text-muted-foreground">−20%</span>
      </button>
    </div>
  );
}
