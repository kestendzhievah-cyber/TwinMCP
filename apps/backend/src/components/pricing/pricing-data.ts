import type { Locale } from "@/lib/i18n/locales";

export type PlanId = "free" | "pro" | "team" | "enterprise";
export type BillingCadence = "monthly" | "annual";

export interface PlanTier {
  id: PlanId;
  name: string;
  blurb: string;
  monthlyUsd: number | null; // null = custom (enterprise)
  annualMonthlyUsd: number | null; // effective monthly price when billed annually (-20%)
  highlighted?: boolean;
  cta: { label: string; href: string };
  bullets: string[]; // marketing bullets shown on the card
}

export const ANNUAL_DISCOUNT_PCT = 20;

export const PLANS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Everything to evaluate the platform.",
    monthlyUsd: 0,
    annualMonthlyUsd: 0,
    cta: { label: "Start free", href: "/sign-up?plan=free" },
    bullets: ["1 server", "5 official MCPs", "Community support", "Public catalog access"],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For developers shipping with AI every day.",
    monthlyUsd: 14.99,
    annualMonthlyUsd: 11.25, // €135/yr
    highlighted: true,
    cta: { label: "Upgrade to Pro", href: "/sign-up?plan=pro" },
    bullets: [
      "25 servers",
      "Publish your own MCPs",
      "Audit logs · 30 days",
      "Priority email support",
    ],
  },
  {
    id: "team",
    name: "Team",
    blurb: "For growing teams shipping together.",
    monthlyUsd: 99,
    annualMonthlyUsd: 82.5, // €990/yr
    cta: { label: "Upgrade to Team", href: "/sign-up?plan=team" },
    bullets: [
      "Unlimited servers",
      "Member management",
      "Audit logs · 90 days",
      "SLA · 99.9% uptime",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "Self-host, SSO, audit, dedicated.",
    monthlyUsd: null, // contact-based
    annualMonthlyUsd: null,
    cta: { label: "Talk to sales", href: "/enterprise" },
    bullets: [
      "Unlimited everything",
      "SSO / SAML / SCIM",
      "Private deployment",
      "Dedicated Slack channel",
    ],
  },
];

export interface FeatureRow {
  group: string;
  label: string;
  description?: string;
  values: Record<PlanId, string | boolean>;
}

export const FEATURES: FeatureRow[] = [
  // Runtime
  {
    group: "Runtime",
    label: "Servers",
    description: "Isolated MCP runtimes you can spin up.",
    values: { free: "1", pro: "25", team: "Unlimited", enterprise: "Unlimited" },
  },
  {
    group: "Runtime",
    label: "Box size",
    description: "small / medium / large box per server.",
    values: { free: "small", pro: "small + medium", team: "all sizes", enterprise: "all sizes" },
  },
  {
    group: "Runtime",
    label: "Region selection",
    values: { free: false, pro: false, team: true, enterprise: true },
  },
  {
    group: "Runtime",
    label: "Private deployment",
    description: "Run TwinMCP control plane in your cloud.",
    values: { free: false, pro: false, team: false, enterprise: true },
  },

  // MCPs
  {
    group: "MCPs",
    label: "Official catalog",
    values: { free: true, pro: true, team: true, enterprise: true },
  },
  {
    group: "MCPs",
    label: "Publish your own MCPs",
    values: { free: false, pro: true, team: true, enterprise: true },
  },
  {
    group: "MCPs",
    label: "Private MCPs (publish-to-self)",
    values: { free: false, pro: true, team: true, enterprise: true },
  },

  // Access & keys
  {
    group: "Access",
    label: "API keys",
    values: { free: "1", pro: "5", team: "20", enterprise: "Unlimited" },
  },
  {
    group: "Access",
    label: "Members",
    values: { free: "1", pro: "1", team: "Up to 10", enterprise: "Unlimited" },
  },
  {
    group: "Access",
    label: "SSO / SAML / SCIM",
    values: { free: false, pro: false, team: false, enterprise: true },
  },

  // Observability
  {
    group: "Observability",
    label: "Live logs",
    values: { free: true, pro: true, team: true, enterprise: true },
  },
  {
    group: "Observability",
    label: "Audit logs retention",
    values: { free: "—", pro: "30 days", team: "90 days", enterprise: "Unlimited" },
  },
  {
    group: "Observability",
    label: "Usage metrics export",
    values: { free: false, pro: true, team: true, enterprise: true },
  },

  // Support
  {
    group: "Support",
    label: "Channels",
    values: {
      free: "Community",
      pro: "Email · 24h",
      team: "Email · 4h business",
      enterprise: "Slack · 1h",
    },
  },
  {
    group: "Support",
    label: "Uptime SLA",
    values: { free: "—", pro: "—", team: "99.9%", enterprise: "Custom" },
  },
];

export function formatPrice(
  plan: PlanTier,
  cadence: BillingCadence,
  locale: Locale = "en"
): string {
  if (plan.monthlyUsd === null) return locale === "fr" ? "Sur devis" : "Custom";
  const value = cadence === "annual" ? (plan.annualMonthlyUsd ?? plan.monthlyUsd) : plan.monthlyUsd;
  return value === 0 ? "€0" : `€${value}`;
}

// French marketing copy per plan (prices, ids and hrefs stay in PLANS above).
// English pages read PLANS directly; only the localized surfaces call planCopy.
const PLAN_COPY_FR: Record<PlanId, { blurb: string; ctaLabel: string; bullets: string[] }> = {
  free: {
    blurb: "Tout pour évaluer la plateforme.",
    ctaLabel: "Commencer gratuitement",
    bullets: ["1 serveur", "5 MCP officiels", "Support communautaire", "Accès au catalogue public"],
  },
  pro: {
    blurb: "Pour les développeurs qui codent avec l’IA au quotidien.",
    ctaLabel: "Passer à Pro",
    bullets: [
      "25 serveurs",
      "Publiez vos propres MCP",
      "Journaux d’audit · 30 jours",
      "Support e-mail prioritaire",
    ],
  },
  team: {
    blurb: "Pour les équipes qui grandissent ensemble.",
    ctaLabel: "Passer à Team",
    bullets: [
      "Serveurs illimités",
      "Gestion des membres",
      "Journaux d’audit · 90 jours",
      "SLA · 99,9 % de disponibilité",
    ],
  },
  enterprise: {
    blurb: "Auto-hébergement, SSO, audit, dédié.",
    ctaLabel: "Contacter l’équipe commerciale",
    bullets: ["Tout en illimité", "SSO / SAML / SCIM", "Déploiement privé", "Canal Slack dédié"],
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
