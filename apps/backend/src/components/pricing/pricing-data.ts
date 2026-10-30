import type { Locale } from "@/lib/i18n/locales";
import { PLAN_CAPABILITIES, maxMcpsForBoxSize } from "@/lib/plan-features";
import { PRICE_TABLE, walletFacts } from "./wallet-copy";

// Pricing since 2026-10-29: a prepaid wallet, no subscription (wallet-copy.ts
// holds the marketing facts, lib/wallet/pricing.ts the prices). This module
// keeps:
//   - FEATURES, the before/after-first-top-up ledger on /plans and /fr/tarifs;
//   - marketingOffers(), the JSON-LD offers of the home pages;
//   - FREE_MCP_LIMIT / freeMcpsLabel, the free-credit server's MCP allowance.

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

// The two account states, as comparison-table columns: "free" = not funded
// yet (sign-up credit), "pro" = funded, pay as you go.
export type PlanId = "free" | "pro";

/**
 * Offers for JSON-LD (softwareApplicationSchema) on the home pages: the free
 * sign-up credit (price 0) and the smallest prepaid top-up. Derived from the
 * wallet price list, so structured data cannot drift from the pricing page.
 */
export function marketingOffers(): {
  name: string;
  price: string;
  priceCurrency: string;
  url: string;
}[] {
  return [
    { name: "Free sign-up credit", price: "0", priceCurrency: "EUR", url: "/plans" },
    {
      name: "Prepaid credit top-up",
      price: String(PRICE_TABLE.minTopupEur),
      priceCurrency: "EUR",
      url: "/plans",
    },
  ];
}

export interface FeatureRow {
  group: string;
  label: string;
  description?: string;
  /** "free" = before the first paid top-up (sign-up credit only), "pro" =
   *  funded, pay as you go. The DB plan names are kept for compatibility. */
  values: Record<PlanId, string | boolean>;
}

const W = walletFacts("en");

/**
 * The pricing ledger on /plans and /fr/tarifs: the account before and after
 * its first paid top-up. Prices come from lib/wallet/pricing.ts, allowances
 * from lib/plan-features.ts; only what the product enforces is listed.
 * /fr/tarifs translates rows by their English label and values by their
 * English text (comparison-table.tsx): keep both in sync.
 */
export const FEATURES: FeatureRow[] = [
  // Credit and prices
  {
    group: "Credit",
    label: "Credit",
    description: `The sign-up credit is promotional: no card, one per person, spent before paid credit. Paid credit is topped up from ${W.minTopup}.`,
    values: {
      free: `${W.signupCredit} at sign-up, ${W.signupDays} days`,
      pro: `Top-ups from ${W.minTopup}`,
    },
  },
  {
    group: "Credit",
    label: "Tool calls",
    description:
      "Tool calls that reach your MCP server, tool errors included. Connecting, listing tools, pings and calls TwinMCP refuses are free.",
    values: { free: `${W.per1000Calls} per 1,000`, pro: `${W.per1000Calls} per 1,000` },
  },
  {
    group: "Credit",
    label: "Compute",
    description: `Active CPU time, as the box measures it: ${W.cpuHour.small} per CPU-hour on small; ${W.largerSizes}. A paused server uses none.`,
    values: {
      free: `${W.cpuHour.small} per CPU-hour`,
      pro: `From ${W.cpuHour.small} per CPU-hour`,
    },
  },
  {
    group: "Credit",
    label: "At zero balance",
    description:
      "Tool calls are refused (HTTP 402) and servers pause. Nothing is charged to a card unless you turned auto-recharge on.",
    values: { free: "Calls stop", pro: "Calls stop, or auto-recharge" },
  },

  // Runtime
  {
    group: "Runtime",
    label: "Servers",
    description: "Isolated MCP runtimes you can spin up.",
    values: {
      free: String(PLAN_CAPABILITIES.free.servers),
      pro: String(PLAN_CAPABILITIES.pro.servers),
    },
  },
  {
    group: "Runtime",
    label: "Box sizes",
    description: `small / medium / large per server: up to ${maxMcpsForBoxSize("small")}, ${maxMcpsForBoxSize("medium")} or ${maxMcpsForBoxSize("large")} MCPs at once.`,
    values: { free: "small", pro: "All sizes" },
  },

  // MCPs
  {
    group: "MCPs",
    label: "Official catalog",
    description:
      "On free credit, MCPs that run shell commands, code or a headless browser are held back until your first top-up.",
    values: { free: "Most MCPs", pro: true },
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
    values: {
      free: String(PLAN_CAPABILITIES.free.apiKeys),
      pro: String(PLAN_CAPABILITIES.pro.apiKeys),
    },
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
    values: { free: "—", pro: `${PLAN_CAPABILITIES.pro.auditRetentionDays} days` },
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
