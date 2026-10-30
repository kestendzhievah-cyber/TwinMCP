"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { track } from "@/lib/analytics/funnel";
import { formatEurAmount } from "@/lib/wallet/pricing";
import {
  checkTopupAmount,
  expiryCountdown,
  formatCredit,
  type NudgeLevel,
} from "@/lib/billing/upgrade-state";

export interface CreditsWallet {
  paidMicros: number;
  promoMicros: number;
  promoExpiresAt: string | null;
  promoExpired: boolean;
  totalMicros: number;
  funded: boolean;
  autoRecharge: {
    enabled: boolean;
    thresholdMicros: number;
    amountMicros: number;
    monthlyCapMicros: number;
    hasPaymentMethod: boolean;
  };
}

export interface AutoRechargeLimits {
  minThresholdEur: number;
  maxThresholdEur: number;
  minAmountEur: number;
  maxAmountEur: number;
  maxMonthlyCapEur: number;
}

interface Props {
  /** null: the balance could not be read (never shown as €0). */
  wallet: CreditsWallet | null;
  level: NudgeLevel;
  legacySubscription: boolean;
  legacyPastDue: boolean;
  hasStripeCustomer: boolean;
  presetsEur: number[];
  minTopupEur: number;
  maxTopupEur: number;
  autoRechargeLimits: AutoRechargeLimits;
  /** Server clock (ISO), so the expiry countdown matches between server and client. */
  serverNow: string;
}

type Banner = { type: "success" | "info" | "error"; message: string };

const eur = (micros: number) => formatCredit(micros, { precise: false });
const toEur = (micros: number) => Math.round(micros / 10_000) / 100;

export function CreditsActions({
  wallet,
  level,
  legacySubscription,
  legacyPastDue,
  hasStripeCustomer,
  presetsEur,
  minTopupEur,
  maxTopupEur,
  autoRechargeLimits,
  serverNow,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState("");

  // Surface the Stripe round trip, then strip the query so a refresh doesn't
  // re-trigger it. Mount-only on purpose: router.replace changes `params`, and
  // re-running would tear down the poll below before its first tick.
  useEffect(() => {
    const topup = params.get("topup");
    const card = params.get("card");
    let poll: ReturnType<typeof setInterval> | null = null;
    if (topup === "success") {
      setBanner({
        type: "success",
        message:
          "Payment received. Your credit is added as soon as Stripe confirms it; this page updates automatically.",
      });
      router.replace("/dashboard/billing");
      // The credit lands with Stripe's webhook (usually seconds): poll a few
      // times so the balance self-updates.
      let n = 0;
      poll = setInterval(() => {
        router.refresh();
        if (++n >= 6 && poll) clearInterval(poll);
      }, 2500);
    } else if (topup === "canceled") {
      track({ name: "checkout_canceled", properties: { from: "billing" } });
      setBanner({ type: "info", message: "Top-up canceled. You were not charged." });
      router.replace("/dashboard/billing");
    } else if (card === "saved") {
      setBanner({
        type: "success",
        message: "Card saved. Auto-recharge uses it from now on; this page updates automatically.",
      });
      router.replace("/dashboard/billing");
      let n = 0;
      poll = setInterval(() => {
        router.refresh();
        if (++n >= 4 && poll) clearInterval(poll);
      }, 2500);
    } else if (card === "canceled") {
      setBanner({ type: "info", message: "No card was saved. Auto-recharge stays off." });
      router.replace("/dashboard/billing");
    } else if (params.get("plan") || params.get("status")) {
      // Old links (pricing page, sign-up) asked for the Pro plan: there is no
      // plan to buy any more, only credit.
      setBanner({
        type: "info",
        message: "TwinMCP is now pay as you go: choose an amount below to add credit.",
      });
      router.replace("/dashboard/billing");
    }
    return () => {
      if (poll) clearInterval(poll);
    };
  }, []);

  async function openPortal() {
    setLoading("portal");
    track({ name: "portal_opened", properties: { surface: "credits" } });
    try {
      const res = await fetch("/api/v2/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setBanner({ type: "error", message: data.message ?? "Could not open the billing portal." });
    } catch {
      setBanner({ type: "error", message: "Network error. Try again." });
    }
    setLoading("");
  }

  const now = new Date(serverNow);
  const expiresAt = wallet?.promoExpiresAt ? new Date(wallet.promoExpiresAt) : null;

  return (
    <div className="space-y-8">
      {/* The Stripe round trip: a tinted memo line (DESIGN.md §5 callouts). */}
      {banner && <BannerLine banner={banner} />}

      {legacySubscription && (
        <div
          className={cn(
            "border border-l-2 px-4 py-3 text-sm",
            legacyPastDue
              ? "border-destructive/40 border-l-destructive bg-destructive/10 text-destructive"
              : "border-info/40 border-l-info bg-info/10 text-info"
          )}
        >
          <p className="font-medium">Your subscription will be converted to credit</p>
          <p className="mt-1 italic text-muted-foreground">
            TwinMCP now bills pay as you go from a prepaid balance. The unused part of your current
            period will be added to your balance and the subscription cancelled; you will get an
            email. There is nothing to do.
            {legacyPastDue &&
              " Your last renewal could not be charged: add credit below to keep your tool calls running."}
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Balance card: the total in large lining figures, then the two buckets. */}
        <Card>
          <CardHeader>
            <CardDescription className="smallcaps tracking-sc text-xs not-italic">
              Balance
            </CardDescription>
            {wallet ? (
              <CardTitle
                className={cn(
                  "lining text-4xl",
                  level === "limit" && "text-destructive",
                  level === "warning" && "text-warning"
                )}
              >
                {eur(wallet.totalMicros)}
              </CardTitle>
            ) : (
              <CardTitle className="text-base font-normal italic text-muted-foreground">
                Your balance could not be loaded. Refresh the page in a moment.
              </CardTitle>
            )}
          </CardHeader>
          {wallet && (
            <CardContent className="space-y-3">
              <dl className="lining divide-y divide-border border-y border-border text-sm">
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="smallcaps tracking-sc text-xs text-muted-foreground">
                    Free credit
                  </dt>
                  <dd className="text-right">
                    <span className="font-medium">{eur(wallet.promoMicros)}</span>
                    {expiresAt && wallet.promoMicros > 0 && (
                      <span className="block text-xs italic text-muted-foreground">
                        Expires {expiryCountdown(expiresAt, now)} · {formatDate(expiresAt)}
                      </span>
                    )}
                    {wallet.promoExpired && (
                      <span className="block text-xs italic text-muted-foreground">Expired</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="smallcaps tracking-sc text-xs text-muted-foreground">
                    Paid credit
                  </dt>
                  <dd className="font-medium">{eur(wallet.paidMicros)}</dd>
                </div>
              </dl>
              <p className="text-xs italic text-muted-foreground">
                Free credit is spent first. Tool calls are refused when the balance reaches zero.
              </p>
              {level === "limit" && (
                <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Your credit is used up: top up to continue.
                </p>
              )}
            </CardContent>
          )}
        </Card>

        <TopUpCard
          presetsEur={presetsEur}
          minTopupEur={minTopupEur}
          maxTopupEur={maxTopupEur}
          funded={Boolean(wallet?.funded)}
          onError={(message) => setBanner({ type: "error", message })}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {wallet && (
          <AutoRechargeCard
            initial={wallet.autoRecharge}
            limits={autoRechargeLimits}
            onBanner={setBanner}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle>Receipts and payment methods</CardTitle>
            <CardDescription>
              Card top-ups come with an invoice; automatic recharges come with a Stripe receipt by
              email. Download invoices and manage your saved cards from the Stripe billing portal.
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
                Available after your first top-up.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BannerLine({ banner }: { banner: Banner }) {
  return (
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
  );
}

function TopUpCard({
  presetsEur,
  minTopupEur,
  maxTopupEur,
  funded,
  onError,
}: {
  presetsEur: number[];
  minTopupEur: number;
  maxTopupEur: number;
  funded: boolean;
  onError: (message: string) => void;
}) {
  const [preset, setPreset] = useState<number | null>(presetsEur[1] ?? presetsEur[0] ?? null);
  const [custom, setCustom] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const chosen =
    preset !== null
      ? ({ ok: true, amountEur: preset } as const)
      : checkTopupAmount(custom, minTopupEur, maxTopupEur);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen.ok) {
      setError(chosen.message);
      return;
    }
    setError("");
    setLoading(true);
    track({
      name: "upgrade_cta_clicked",
      properties: { source: "billing", level: "offer", reason: `topup_${chosen.amountEur}` },
    });
    try {
      const res = await fetch("/api/v2/wallet/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountEur: chosen.amountEur, saveCard }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      onError(data.message ?? "Could not start the payment. Try again.");
    } catch {
      onError("Network error. Try again.");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add credit</CardTitle>
        <CardDescription>
          {funded
            ? "Top up any time. The amount is added to your balance as soon as the payment goes through."
            : "Your first top-up unlocks every box size, more servers and publishing your own MCPs."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {/* Hairline stamps side by side; the chosen amount is pressed in ink. */}
          <div
            role="group"
            aria-label="Amount"
            className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4"
          >
            {presetsEur.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setPreset(amount);
                  setCustom("");
                  setError("");
                }}
                aria-pressed={preset === amount}
                className={cn(
                  "lining h-10 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-px",
                  preset === amount
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {formatEurAmount(amount)}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-custom">Other amount (€)</Label>
            <Input
              id="topup-custom"
              inputMode="numeric"
              placeholder={`${minTopupEur} to ${maxTopupEur}`}
              value={custom}
              onFocus={() => setPreset(null)}
              onChange={(e) => {
                setPreset(null);
                setCustom(e.target.value);
                setError("");
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "topup-custom-hint topup-error" : "topup-custom-hint"}
              className="lining"
            />
            <p id="topup-custom-hint" className="text-xs italic text-muted-foreground">
              Whole euros, from {formatEurAmount(minTopupEur)} to {formatEurAmount(maxTopupEur)}.
            </p>
          </div>
          <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              className="mt-1 h-4 w-4 accent-foreground"
            />
            <span>
              Save this card for auto-recharge
              <span className="block text-xs italic text-muted-foreground">
                Nothing is charged automatically until you turn auto-recharge on.
              </span>
            </span>
          </label>
          {error && (
            <p
              id="topup-error"
              role="alert"
              className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Redirecting…"
              : chosen.ok
                ? `Top up ${formatEurAmount(chosen.amountEur)}`
                : "Top up"}
          </Button>
          <p className="text-xs italic text-muted-foreground">
            Secure payment by Stripe. No subscription, nothing charged again unless you top up or
            turn on auto-recharge.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

function AutoRechargeCard({
  initial,
  limits,
  onBanner,
}: {
  initial: CreditsWallet["autoRecharge"];
  limits: AutoRechargeLimits;
  onBanner: (b: Banner) => void;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [threshold, setThreshold] = useState(String(toEur(initial.thresholdMicros)));
  const [amount, setAmount] = useState(String(toEur(initial.amountMicros)));
  const [cap, setCap] = useState(String(toEur(initial.monthlyCapMicros)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState<CardInfo | null>(null);
  const [monthEur, setMonthEur] = useState<number | null>(null);

  // The saved card and this month's total come from the auto-recharge API
  // (Stripe lookup), best effort: the form works without them.
  useEffect(() => {
    let alive = true;
    fetch("/api/v2/wallet/auto-recharge", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { card?: CardInfo | null; rechargedThisMonthEur?: number } | null) => {
        if (!alive || !d) return;
        setCard(d.card ?? null);
        if (typeof d.rechargedThisMonthEur === "number") setMonthEur(d.rechargedThisMonthEur);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/v2/wallet/auto-recharge", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.needsCard && data.url) {
        // No saved card yet: the settings are kept (still off) and Stripe
        // collects the card; the webhook turns auto-recharge on afterwards.
        onBanner({ type: "info", message: "Opening a secure page to save your card…" });
        window.location.href = data.url;
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "Could not save auto-recharge settings.");
      } else {
        onBanner({
          type: "success",
          message: data.enabled ? "Auto-recharge is on." : "Auto-recharge settings saved.",
        });
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSaving(false);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const nums = [threshold, amount, cap].map((v) => Number(v.trim().replace(",", ".")));
    if (nums.some((n) => !Number.isFinite(n))) {
      setError("Enter amounts in euros.");
      return;
    }
    const [thresholdEur, amountEur, monthlyCapEur] = nums;
    void patch({ enabled, thresholdEur, amountEur, monthlyCapEur });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          Auto-recharge
          <Badge variant={initial.enabled ? "success" : "secondary"}>
            {initial.enabled ? "On" : "Off"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Refill your balance with your saved card when it drops below a threshold, never more than
          your monthly cap. Off by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4" noValidate>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Turn on auto-recharge
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <AmountField
              id="ar-threshold"
              errorId={error ? "ar-error" : undefined}
              label="When below (€)"
              value={threshold}
              onChange={setThreshold}
              hint={`From ${formatEurAmount(limits.minThresholdEur)}`}
            />
            <AmountField
              id="ar-amount"
              errorId={error ? "ar-error" : undefined}
              label="Add (€)"
              value={amount}
              onChange={setAmount}
              hint={`${formatEurAmount(limits.minAmountEur)} to ${formatEurAmount(limits.maxAmountEur)}`}
            />
            <AmountField
              id="ar-cap"
              errorId={error ? "ar-error" : undefined}
              label="Monthly cap (€)"
              value={cap}
              onChange={setCap}
              hint={`Up to ${formatEurAmount(limits.maxMonthlyCapEur)}`}
            />
          </div>
          <p className="lining text-xs italic text-muted-foreground">
            {card
              ? `Card: ${card.brand} ending ${card.last4}, expires ${String(card.expMonth).padStart(2, "0")}/${card.expYear}.`
              : initial.hasPaymentMethod
                ? "A card is saved."
                : "No card saved yet: turning auto-recharge on opens a secure Stripe page to save one."}
            {monthEur !== null &&
              monthEur > 0 &&
              ` Recharged this month: ${formatEurAmount(monthEur)}.`}
          </p>
          {error && (
            <p
              id="ar-error"
              role="alert"
              className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {initial.hasPaymentMethod && (
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => void patch({ updateCard: true })}
              >
                Replace card
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
  hint,
  errorId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  /** Set while the form shows an error: linked and flagged for assistive tech. */
  errorId?: string;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!errorId}
        aria-describedby={errorId ? `${hintId} ${errorId}` : hintId}
        className="lining"
      />
      <p id={hintId} className="lining text-xs italic text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
