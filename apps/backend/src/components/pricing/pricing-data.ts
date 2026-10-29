import type { Locale } from "@/lib/i18n/locales";
import { maxMcpsForBoxSize } from "@/lib/plan-features";

/**
 * Box-hosted MCPs a Free server (small box, lib/plan-features.ts) runs at once.
 * TwinMCP Docs is served by the control plane and does not count, hence the
 * "+ TwinMCP Docs" in the label. Derived from code so it follows MAX_MCPS_SMALL.
 */
export const FREE_MCP_LIMIT = maxMcpsForBoxSize("small");

/** "Up to N MCPs + TwinMCP Docs", the Free plan's MCP line, per locale. */
export function freeMcpsLabel(locale: Locale = "en"): string {
  return locale === "fr"
    ? `Jusqu’à ${FREE_MCP_LIMIT} MCP + TwinMCP Docs`
    : `Up to ${FREE_MCP_LIMIT} MCPs + TwinMCP Docs`;
}

// Two plans are sold: Free and Pro. Team is grandfathered for existing
// subscribers only (lib/plan-features.ts, the Stripe webhook and the billing
// mappings still know it) and is deliberately absent from every pricing surface.
export type PlanId = "free" | "pro";
export type BillingCadence = "monthly" | "annual";

export interface PlanTier {
  id: PlanId;
  name: string;
  blurb: string;
  monthlyUsd: number; // EUR, despite the legacy field name (matches the Stripe prices)
  annualMonthlyUsd: number; // effective monthly price when billed annually
  annualTotalEur: number; // what the yearly Stripe price charges, once a year
  highlighted?: boolean;
  cta: { label: string; href: string };
  bullets: string[]; // marketing bullets shown on the card
}

// Pro billed annually: €135/yr = €11.25/mo vs €14.99 monthly ≈ 25% off
// ("Save up to 25%" on the cadence toggle).
export const ANNUAL_DISCOUNT_PCT = 25;

// Quotas mirror lib/plan-features.ts (PLAN_CAPABILITIES) and the daily MCP
// request limits in lib/rate-limit.ts. Only list what the product enforces.
export const PLANS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Everything to evaluate the platform.",
    monthlyUsd: 0,
    annualMonthlyUsd: 0,
    annualTotalEur: 0,
    cta: { label: "Start free", href: "/sign-up?plan=free" },
    bullets: ["1 server", freeMcpsLabel("en"), "50 tool calls / day", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Everything we offer, for developers shipping with AI every day.",
    monthlyUsd: 14.99,
    annualMonthlyUsd: 11.25, // €135/yr
    annualTotalEur: 135,
    highlighted: true,
    cta: { label: "Try Pro free for 1 month", href: "/sign-up?plan=pro" },
    bullets: [
      "50 servers",
      "All box sizes (small, medium, large)",
      "5,000 tool calls / day",
      "Publish your own MCPs",
      "20 API keys",
      "Audit logs · 90 days",
      "Usage export",
      "Priority email support",
    ],
  },
];

/**
 * Offers for JSON-LD (softwareApplicationSchema), derived from PLANS so the
 * structured data search engines index can never drift from the pricing page.
 * EUR, to match the real Stripe prices.
 */
export function marketingOffers(): {
  name: string;
  price: string;
  priceCurrency: string;
  url: string;
}[] {
  return PLANS.map((p) => ({
    name: p.name,
    price: String(p.monthlyUsd),
    priceCurrency: "EUR",
    url: "/plans",
  }));
}

export interface FeatureRow {
  group: string;
  label: string;
  description?: string;
  values: Record<PlanId, string | boolean>;
}

// Free vs Pro, rows the runtime actually enforces. Region selection, members,
// SSO, private deployment and uptime SLAs are not sold, so they are not listed.
export const FEATURES: FeatureRow[] = [
  // Runtime
  {
    group: "Runtime",
    label: "Servers",
    description: "Isolated MCP runtimes you can spin up.",
    values: { free: "1", pro: "50" },
  },
  {
    group: "Runtime",
    label: "Box sizes",
    description: `small / medium / large per server: up to ${maxMcpsForBoxSize("small")}, ${maxMcpsForBoxSize("medium")} or ${maxMcpsForBoxSize("large")} MCPs at once.`,
    values: { free: "small", pro: "All sizes" },
  },
  {
    group: "Runtime",
    // /fr/tarifs translates rows by their English label (comparison-table.tsx
    // FEATURE_COPY_FR): keep both keys in sync. Only tool calls are counted
    // (lib/mcp/billable.ts).
    label: "Tool calls per day",
    description:
      "Tool calls across all your servers, per 24-hour window. Connecting and listing tools is free. At the cap, calls are refused until the window resets; nothing is billed.",
    values: { free: "50", pro: "5,000" },
  },

  // MCPs
  {
    group: "MCPs",
    label: "Official catalog",
    values: { free: true, pro: true },
  },
  {
    group: "MCPs",
    label: "Publish your own MCPs",
    description: "Published MCPs stay private to your account.",
    values: { free: false, pro: true },
  },

  // Access & keys
  {
    group: "Access",
    label: "API keys",
    values: { free: "3", pro: "20" },
  },

  // Observability
  {
    group: "Observability",
    label: "Live logs",
    values: { free: true, pro: true },
  },
  {
    group: "Observability",
    label: "Audit logs retention",
    values: { free: "—", pro: "90 days" },
  },
  {
    group: "Observability",
    label: "Usage metrics export",
    values: { free: false, pro: true },
  },

  // Support
  {
    group: "Support",
    label: "Channels",
    values: { free: "Community", pro: "Priority email" },
  },
];

// English prints "€14.99"; French prints "14,99 €" with a non-breaking space,
// matching the hand-written FR copy (teaser, FAQ). Whole amounts drop the
// decimals ("€135", "135 €").
export function formatEur(value: number, locale: Locale = "en"): string {
  const digits = Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (locale === "fr") return `${digits.replace(".", ",")} €`;
  return `€${digits}`;
}

export function formatPrice(
  plan: PlanTier,
  cadence: BillingCadence,
  locale: Locale = "en"
): string {
  return formatEur(cadence === "annual" ? plan.annualMonthlyUsd : plan.monthlyUsd, locale);
}

/**
 * The line under an annual price, so the yearly charge is never a surprise:
 * "€135 billed yearly after your free month · €11.25/mo". `trial: false` (a
 * creator promo replaces the free month) drops "after your free month".
 * Null for the free plan.
 */
export function annualBillingNote(
  plan: PlanTier,
  locale: Locale = "en",
  opts: { trial: boolean } = { trial: true }
): string | null {
  if (plan.annualTotalEur <= 0) return null;
  const total = formatEur(plan.annualTotalEur, locale);
  const perMonth = formatEur(plan.annualMonthlyUsd, locale);
  if (locale === "fr") {
    return `${total} facturés à l’année${opts.trial ? " après votre mois offert" : ""} · ${perMonth}/mois`;
  }
  return `${total} billed yearly${opts.trial ? " after your free month" : ""} · ${perMonth}/mo`;
}

/** Short annual hint for compact cards (home teaser): "€11.25/mo billed yearly". */
export function annualMonthlyHint(plan: PlanTier, locale: Locale = "en"): string | null {
  if (plan.annualMonthlyUsd <= 0) return null;
  const perMonth = formatEur(plan.annualMonthlyUsd, locale);
  return locale === "fr"
    ? `${perMonth}/mois en facturation annuelle`
    : `${perMonth}/mo billed yearly`;
}

// French marketing copy per plan (prices, ids and hrefs stay in PLANS above).
// English pages read PLANS directly; only the localized surfaces call planCopy.
const PLAN_COPY_FR: Record<PlanId, { blurb: string; ctaLabel: string; bullets: string[] }> = {
  free: {
    blurb: "Tout pour évaluer la plateforme.",
    ctaLabel: "Commencer gratuitement",
    bullets: [
      "1 serveur",
      freeMcpsLabel("fr"),
      "50 appels d’outils par jour",
      "Support communautaire",
    ],
  },
  pro: {
    blurb: "Tout ce que nous proposons, pour les développeurs qui codent avec l’IA au quotidien.",
    ctaLabel: "Essayer Pro 1 mois gratuit",
    bullets: [
      "50 serveurs",
      "Toutes les tailles de box (small, medium, large)",
      "5 000 appels d’outils par jour",
      "Publiez vos propres MCP",
      "20 clés API",
      "Journaux d’audit · 90 jours",
      "Export de l’usage",
      "Support prioritaire par e-mail",
    ],
  },
};

export interface PlanCopy {
  blurb: string;
  ctaLabel: string;
  bullets: string[];
}

// Returns the plan's marketing copy in the given locale (falls back to English).
export function planCopy(plan: PlanTier, locale: Locale): PlanCopy {
  if (locale === "fr") {
    const fr = PLAN_COPY_FR[plan.id];
    return { blurb: fr.blurb, ctaLabel: fr.ctaLabel, bullets: fr.bullets };
  }
  return { blurb: plan.blurb, ctaLabel: plan.cta.label, bullets: plan.bullets };
}
