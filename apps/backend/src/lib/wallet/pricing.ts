import type { BoxSize } from "@/db/schema/platform";

// Wallet price list (contract W1). Every price is the REAL cost to TwinMCP
// times PRICING.multiplier, converted to integer micro-euros (€1 = 1_000_000).
// Pure module: no DB, no I/O, safe to import from client components.

export const MICROS_PER_EUR = 1_000_000;

/**
 * Upstash Box pay-as-you-go list prices, USD per active CPU-hour
 * (upstash.com/pricing/box, 2026-10). Only the SMALL rate is a confirmed
 * per-core figure (Upstash's own example: 100% of 2 cores for 1 h = $0.20 on
 * small). Whether medium/large are per core or per box is unconfirmed, so no
 * public page quotes them and the CPU-time meter never bills above the small
 * rate (UPSTASH_CORE_HOUR_USD); medium/large are billed from the compute cost
 * their box reports.
 */
export const UPSTASH_CPU_HOUR_USD: Readonly<Record<BoxSize, number>> = {
  small: 0.1,
  medium: 0.2,
  large: 0.4,
};

/** USD per active core-hour used when only CPU time is known (any box size). */
export const UPSTASH_CORE_HOUR_USD = UPSTASH_CPU_HOUR_USD.small;

export interface Pricing {
  /** Price = real cost × multiplier. */
  multiplier: number;
  /** EUR per USD, applied to Upstash's USD costs. */
  usdToEur: number;
  /** REAL cost (EUR) of relaying 1,000 tool calls, before the multiplier. */
  callCostEurPer1000: number;
  signupCreditEur: number;
  signupCreditDays: number;
  minTopupEur: number;
  topupPresetsEur: readonly number[];
  maxTopupEur: number;
  /** How far below zero metered compute may run before boxes are stopped. */
  overdraftEur: number;
  /**
   * REAL-cost caps (EUR, before the multiplier) on compute paid with
   * promotional credit only. They must sit below what the promo is worth in
   * real cost (signupCreditEur / multiplier), or the kill switch could only
   * trip after the credit is already gone: by default 20% of it per UTC day
   * and 90% in total (with €10 and ×10: €0.20 and €0.90 of real cost, i.e.
   * €2 and €9 of billed compute).
   */
  promoDailyCostCapEur: number;
  promoTotalCostCapEur: number;
}

function envNumber(name: string, fallback: number, min = 0): number {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/** Built from the environment; exported for tests and for a fresh read after env changes. */
export function loadPricing(): Pricing {
  const multiplier = envNumber("WALLET_COST_MULTIPLIER", 10, 1);
  const signupCreditEur = 10;
  // What the sign-up credit is worth in real cost; the promo caps are shares of it.
  const promoRealEur = signupCreditEur / multiplier;
  return {
    multiplier,
    usdToEur: envNumber("WALLET_USD_EUR", 0.92),
    callCostEurPer1000: envNumber("WALLET_CALL_COST_EUR_PER_1000", 0.01),
    signupCreditEur,
    signupCreditDays: 30,
    minTopupEur: 10,
    topupPresetsEur: [10, 25, 50, 100],
    maxTopupEur: 1000,
    overdraftEur: 0.5,
    promoDailyCostCapEur: Math.round(promoRealEur * 0.2 * 1e6) / 1e6,
    promoTotalCostCapEur: Math.round(promoRealEur * 0.9 * 1e6) / 1e6,
  };
}

export const PRICING: Readonly<Pricing> = Object.freeze(loadPricing());

/** Whole micro-euros from euros (half away from zero; tolerant of float noise like 0.1 + 0.2). */
export function eurToMicros(eur: number): number {
  if (!Number.isFinite(eur)) return 0;
  const m = eur * MICROS_PER_EUR;
  const r = Math.sign(m) * Math.round(Math.abs(m));
  return r === 0 ? 0 : r; // never -0
}

export function microsToEur(micros: number): number {
  return micros / MICROS_PER_EUR;
}

/**
 * Price of `calls` relayed tool calls, in micro-euros. Rounded once on the
 * total (not per call), so batching never drifts. Non-positive or non-finite
 * input costs 0; fractional calls are floored.
 */
export function priceToolCallsMicros(calls: number, p: Pricing = PRICING): number {
  if (!Number.isFinite(calls) || calls <= 0) return 0;
  const n = Math.floor(calls);
  return Math.round((n * p.callCostEurPer1000 * p.multiplier * MICROS_PER_EUR) / 1000);
}

/**
 * Price of `costUsd` of real Upstash compute, in micro-euros:
 * costUsd × usdToEur × multiplier. Negative or non-finite input costs 0.
 * Callers metering cumulative counters should price the cumulative total and
 * diff the priced values, so per-sample rounding cannot accumulate.
 */
export function priceComputeMicros(costUsd: number, p: Pricing = PRICING): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return 0;
  return Math.round(costUsd * p.usdToEur * p.multiplier * MICROS_PER_EUR);
}

/** Decimal places that show a price without hiding it: 2 normally, more below one cent. */
function fractionDigitsFor(micros: number): number {
  const abs = Math.abs(micros);
  if (abs === 0 || abs >= 10_000) return 2; // >= €0.01
  if (abs >= 1_000) return 3;
  if (abs >= 100) return 4;
  if (abs >= 10) return 5;
  return 6;
}

/** "€10.00" (en) or "10,00 €" (fr). Sub-cent amounts keep enough decimals to stay non-zero. */
export function formatEur(micros: number, locale: "en" | "fr" = "en"): string {
  const digits = fractionDigitsFor(micros);
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(micros / MICROS_PER_EUR);
}

/**
 * A euro amount for copy: whole euros without decimals ("€10", "€1,000";
 * fr "10 €"), anything else with two ("€2.50"). For limits, presets and
 * "from €10"-style lines; balances use formatEur.
 */
export function formatEurAmount(eur: number, locale: "en" | "fr" = "en"): string {
  const whole = Number.isInteger(eur);
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(eur);
}

/** "€10": the smallest top-up, for "from €10" lines. */
export function minTopupLabel(locale: "en" | "fr" = "en", p: Pricing = PRICING): string {
  return formatEurAmount(p.minTopupEur, locale);
}

/** Round a euro amount for display tables (4 decimals, no float tails). */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export interface PublicPriceTable {
  currency: "EUR";
  per1000CallsEur: number;
  /**
   * Per active CPU-hour on a small box. Medium and large are not quoted: they
   * are billed from the compute cost their box reports (see UPSTASH_CPU_HOUR_USD).
   */
  cpuHourEur: { small: number };
  signupCreditEur: number;
  signupCreditDays: number;
  minTopupEur: number;
  topupPresetsEur: number[];
  maxTopupEur: number;
  notes: { en: string[]; fr: string[] };
}

export function publicPriceTable(p: Pricing = PRICING): PublicPriceTable {
  const cpu = (size: BoxSize) => round4(UPSTASH_CPU_HOUR_USD[size] * p.usdToEur * p.multiplier);
  const signup = {
    en: formatEur(eurToMicros(p.signupCreditEur), "en"),
    fr: formatEur(eurToMicros(p.signupCreditEur), "fr"),
  };
  const minTopup = {
    en: formatEur(eurToMicros(p.minTopupEur), "en"),
    fr: formatEur(eurToMicros(p.minTopupEur), "fr"),
  };
  return {
    currency: "EUR",
    per1000CallsEur: round4(p.callCostEurPer1000 * p.multiplier),
    cpuHourEur: { small: cpu("small") },
    signupCreditEur: p.signupCreditEur,
    signupCreditDays: p.signupCreditDays,
    minTopupEur: p.minTopupEur,
    topupPresetsEur: [...p.topupPresetsEur],
    maxTopupEur: p.maxTopupEur,
    notes: {
      en: [
        "Tool calls that reach your MCP server are charged, including calls that return a tool error. Calls refused by TwinMCP are not charged.",
        "Connecting a client, listing tools and pings are not charged as tool calls; the CPU time they use is part of compute.",
        "Compute is charged on the active CPU time your server uses, as measured by its box. A paused server uses no CPU time; an awake but idle server uses very little, and servers pause on their own after a period without activity.",
        "Medium and large servers cost more per CPU-hour than small ones: their compute follows the cost their box reports.",
        "If a box does not report its CPU time, compute is estimated from the time the server is awake; those rows are marked estimated in your history.",
        `New accounts get ${signup.en} of promotional credit, valid ${p.signupCreditDays} days, no card required. Promotional credit is spent before paid credit.`,
        `Top-ups start at ${minTopup.en}. There is no subscription.`,
      ],
      fr: [
        "Les appels d’outils qui atteignent votre serveur MCP sont facturés, y compris ceux qui renvoient une erreur d’outil. Les appels refusés par TwinMCP ne sont pas facturés.",
        "La connexion d’un client, la liste des outils et les pings ne sont pas facturés comme appels d’outils\u202f; le temps CPU qu’ils utilisent fait partie du calcul.",
        "Le calcul est facturé au temps CPU actif utilisé par votre serveur, tel que mesuré par sa box. Un serveur en pause ne consomme pas de temps CPU\u202f; un serveur éveillé mais inactif en consomme très peu, et les serveurs se mettent en pause d’eux-mêmes après une période sans activité.",
        "Les serveurs medium et large coûtent plus cher par heure CPU que les small\u202f: leur calcul suit le coût que leur box déclare.",
        "Si une box ne déclare pas son temps CPU, le calcul est estimé à partir du temps pendant lequel le serveur est éveillé\u202f; ces lignes sont marquées comme estimées dans votre historique.",
        `Les nouveaux comptes reçoivent ${signup.fr} de crédit promotionnel, valable ${p.signupCreditDays} jours, sans carte bancaire. Le crédit promotionnel est consommé avant le crédit payé.`,
        `Recharge à partir de ${minTopup.fr}. Aucun abonnement.`,
      ],
    },
  };
}

export interface WhatItBuys {
  amountEur: number;
  /** Tool calls the amount pays for if nothing else is used. */
  toolCalls: number;
  /** Active CPU-hours the amount pays for on a small box, if nothing else is used. */
  cpuHours: { small: number };
  examples: { en: string[]; fr: string[] };
}

/**
 * What `amountEur` (default the sign-up credit) pays for, computed from the
 * live price list. Each figure assumes the whole amount goes to that one item.
 */
export function whatTenEuroBuys(
  p: Pricing = PRICING,
  amountEur: number = p.signupCreditEur
): WhatItBuys {
  const micros = eurToMicros(amountEur);
  const perThousand = priceToolCallsMicros(1000, p);
  const toolCalls = perThousand > 0 ? Math.floor((micros * 1000) / perThousand) : 0;
  const perHour = priceComputeMicros(UPSTASH_CORE_HOUR_USD, p);
  const cpuHours = { small: perHour > 0 ? Math.floor((micros / perHour) * 10) / 10 : 0 };
  const en = new Intl.NumberFormat("en-US");
  const fr = new Intl.NumberFormat("fr-FR");
  const amount = { en: formatEur(micros, "en"), fr: formatEur(micros, "fr") };
  const per1000 = {
    en: formatEur(perThousand, "en"),
    fr: formatEur(perThousand, "fr"),
  };
  return {
    amountEur,
    toolCalls,
    cpuHours,
    examples: {
      en: [
        `Tool calls alone: ${en.format(toolCalls)} for ${amount.en}, at ${per1000.en} per 1,000. The CPU time those calls use is charged on top.`,
        `Compute alone: about ${en.format(cpuHours.small)} hours of active CPU time on a small server.`,
      ],
      fr: [
        `Les appels d’outils seuls\u202f: ${fr.format(toolCalls)} pour ${amount.fr}, à ${per1000.fr} les 1\u202f000. Le temps CPU que ces appels utilisent est facturé en plus.`,
        `Le calcul seul\u202f: environ ${fr.format(cpuHours.small)} heures de temps CPU actif sur un petit serveur.`,
      ],
    },
  };
}
