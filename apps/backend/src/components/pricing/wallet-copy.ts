// Marketing facts for the prepaid wallet, derived from the price list in
// lib/wallet/pricing.ts (publicPriceTable, whatTenEuroBuys) and the plan
// allowances in lib/plan-features.ts. Every page that states a TwinMCP price
// reads it from here, so no copy can hard-code a number that drifts from what
// the ledger charges. Pure module: no React, no I/O, safe in client bundles.
//
// The model (owner decision 2026-10-29): no subscription. A prepaid balance in
// euros, spent on tool calls and on the active CPU time servers use. €10 of
// promotional credit at sign-up (no card, valid 30 days). At zero, tool calls
// are refused (HTTP 402, JSON-RPC -32008) and servers pause: nothing is ever
// charged to a card unless the user turned auto-recharge on.
//
// Plan names in the database are kept for backward compatibility: "free" means
// "not funded yet" (sign-up credit only), "pro" means "funded, pay as you go"
// (at least one paid top-up). Neither is sold as a plan any more.

import type { BoxSize } from "@/db/schema/platform";
import type { Locale } from "@/lib/i18n/locales";
import { PLAN_CAPABILITIES, maxMcpsForBoxSize } from "@/lib/plan-features";
import {
  PRICING,
  eurToMicros,
  formatEur as formatMicros,
  publicPriceTable,
  whatTenEuroBuys,
  type PublicPriceTable,
} from "@/lib/wallet/pricing";

type L<T> = Record<Locale, T>;

/** The live public price list (env-driven defaults: cost × multiplier). */
export const PRICE_TABLE: PublicPriceTable = publicPriceTable();

/** What the sign-up credit pays for, from the same price list. */
export const TEN_EURO = whatTenEuroBuys();

/** Where the docs explain credits and prices (anchor on /docs and /fr/docs). */
export const CREDIT_DOCS_ANCHOR = "credit";

export const BOX_SIZES: readonly BoxSize[] = ["small", "medium", "large"];

/**
 * A euro amount for copy: whole amounts drop the decimals ("€10", "10 €"),
 * others keep what they need to stay exact ("€0.10", "0,92 €"). French puts a
 * no-break space before the sign, as the pricing helper formats it.
 */
export function eurAmount(eur: number, locale: Locale = "en"): string {
  if (Number.isInteger(eur)) {
    const digits = eur.toLocaleString(locale === "fr" ? "fr-FR" : "en-US").replace(/ /g, " ");
    return locale === "fr" ? `${digits} €` : `€${digits}`;
  }
  return formatMicros(eurToMicros(eur), locale).replace(/ /g, " ");
}

/** An integer the way each locale writes it ("100,000" / "100 000"). */
export function count(n: number, locale: Locale = "en"): string {
  return n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US").replace(/ /g, " ");
}

export interface WalletFacts {
  /** "€10" / "10 €": the sign-up credit. */
  signupCredit: string;
  /** Days the sign-up credit stays valid (30). */
  signupDays: number;
  /** "€10": the smallest top-up. */
  minTopup: string;
  /** "€1,000": the largest single top-up. */
  maxTopup: string;
  /** Preset top-up amounts, formatted. */
  presets: string[];
  /** "€0.10": price of 1,000 tool calls. */
  per1000Calls: string;
  /**
   * Price of one active CPU-hour on a small box. Medium and large are not
   * quoted (lib/wallet/pricing.ts UPSTASH_CPU_HOUR_USD): see `largerSizes`.
   */
  cpuHour: { small: string };
  /** How medium and large boxes are billed, as a sentence fragment. */
  largerSizes: string;
  /** "100,000": tool calls the sign-up credit pays for on its own. */
  creditCalls: string;
  /** Active CPU-hours the sign-up credit pays for on a small box. */
  creditCpuHours: { small: string };
  /** Servers before the first paid top-up (1, small box). */
  creditServers: number;
  /** Servers once the account is funded (50). */
  fundedServers: number;
  /** MCPs a small box runs at once. */
  smallMcps: number;
  /** How far metered compute may take a balance below zero before the pause. */
  overdraft: string;
}

export function walletFacts(
  locale: Locale = "en",
  table: PublicPriceTable = PRICE_TABLE
): WalletFacts {
  const hours = (h: number) =>
    h.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 });
  return {
    signupCredit: eurAmount(table.signupCreditEur, locale),
    signupDays: table.signupCreditDays,
    minTopup: eurAmount(table.minTopupEur, locale),
    maxTopup: eurAmount(table.maxTopupEur, locale),
    presets: table.topupPresetsEur.map((v) => eurAmount(v, locale)),
    per1000Calls: eurAmount(table.per1000CallsEur, locale),
    cpuHour: { small: eurAmount(table.cpuHourEur.small, locale) },
    largerSizes:
      locale === "fr"
        ? "les serveurs medium et large coûtent plus cher par heure CPU et suivent le coût de calcul que leur box déclare"
        : "medium and large servers cost more per CPU-hour and follow the compute cost their box reports",
    creditCalls: count(TEN_EURO.toolCalls, locale),
    creditCpuHours: { small: hours(TEN_EURO.cpuHours.small) },
    creditServers: PLAN_CAPABILITIES.free.servers,
    fundedServers: PLAN_CAPABILITIES.pro.servers,
    smallMcps: maxMcpsForBoxSize("small"),
    overdraft: eurAmount(PRICING.overdraftEur, locale),
  };
}

const EN = walletFacts("en");
const FR = walletFacts("fr");

/**
 * The one-paragraph pricing statement shared by the compare pages, the
 * solution pages, the catalogue pages and the llms briefs.
 */
export const WALLET_SUMMARY: L<string> = {
  en: `Pay as you go, no subscription. New accounts get ${EN.signupCredit} of free credit (no card, valid ${EN.signupDays} days); after that you top up a prepaid balance from ${EN.minTopup}. Tool calls cost ${EN.per1000Calls} per 1,000 and compute ${EN.cpuHour.small} per active CPU-hour on a small server. At zero, calls stop: no surprise bills.`,
  fr: `Paiement à l’usage, sans abonnement. Les nouveaux comptes reçoivent ${FR.signupCredit} de crédit offert (sans carte, valable ${FR.signupDays} jours) ; ensuite, vous rechargez un solde prépayé à partir de ${FR.minTopup}. Les appels d’outils coûtent ${FR.per1000Calls} les 1 000 et le calcul ${FR.cpuHour.small} par heure de CPU actif sur un petit serveur. À zéro, les appels s’arrêtent : aucune facture surprise.`,
};

/** Short offer line for CTAs and reassurance rows. */
export const SIGNUP_OFFER: L<string> = {
  en: `${EN.signupCredit} of free credit at sign-up, no card`,
  fr: `${FR.signupCredit} de crédit offert à l’inscription, sans carte`,
};

/** What funding (a first paid top-up) unlocks, in one line. */
export const FUNDED_UNLOCKS: L<string> = {
  en: `After your first top-up: up to ${EN.fundedServers} servers, every box size and your own published MCPs.`,
  fr: `Après votre première recharge : jusqu’à ${FR.fundedServers} serveurs, toutes les tailles de box et vos propres MCP publiés.`,
};

/** The two account states, as column / card names. */
export const ACCOUNT_STATES: L<{ credit: string; funded: string }> = {
  en: { credit: "Free credit", funded: "Pay as you go" },
  fr: { credit: "Crédit offert", funded: "Paiement à l’usage" },
};

/**
 * Product JSON-LD for the pricing pages: two offers (the free sign-up credit
 * and the smallest prepaid top-up), plus the two unit prices. No monthly
 * price: nothing is billed by the month.
 */
export function walletProductSchema(opts: {
  siteUrl: string;
  path: string;
  locale: Locale;
  table?: PublicPriceTable;
}) {
  const table = opts.table ?? PRICE_TABLE;
  const url = `${opts.siteUrl.replace(/\/+$/, "")}${opts.path}`;
  const fr = opts.locale === "fr";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "TwinMCP",
    description: WALLET_SUMMARY[opts.locale],
    brand: { "@id": `${opts.siteUrl.replace(/\/+$/, "")}/#organization` },
    offers: [
      {
        "@type": "Offer",
        name: fr ? "Crédit d’inscription offert" : "Free sign-up credit",
        price: "0",
        priceCurrency: "EUR",
        url,
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: fr ? "Recharge de crédit prépayé" : "Prepaid credit top-up",
        price: String(table.minTopupEur),
        priceCurrency: "EUR",
        url,
        availability: "https://schema.org/InStock",
        priceSpecification: [
          {
            "@type": "UnitPriceSpecification",
            name: fr ? "Appels d’outils" : "Tool calls",
            price: table.per1000CallsEur,
            priceCurrency: "EUR",
            referenceQuantity: { "@type": "QuantitativeValue", value: 1000, unitText: "calls" },
          },
          {
            "@type": "UnitPriceSpecification",
            name: fr ? "Heure de CPU actif (small)" : "Active CPU-hour (small)",
            price: table.cpuHourEur.small,
            priceCurrency: "EUR",
            referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR" },
          },
        ],
      },
    ],
  };
}

// ─── Estimator ────────────────────────────────────────────────────────────────

/** Days in the estimator's month. */
export const ESTIMATE_DAYS = 30;

/**
 * Average CPU use while a server is busy, as a share of one core. These are
 * the estimator's adjustable assumptions, not measurements: the bill uses the
 * CPU time the box actually records.
 */
export const WORKLOADS = [
  { id: "idle", cpuShare: 0.01 },
  { id: "light", cpuShare: 0.05 },
  { id: "heavy", cpuShare: 0.25 },
] as const;

export type WorkloadId = (typeof WORKLOADS)[number]["id"];

export interface EstimateInput {
  servers: number;
  hoursPerDay: number;
  callsPerDay: number;
  /** Share of one core used while busy (0..1, e.g. 0.05). */
  cpuShare: number;
  days?: number;
}

export interface Estimate {
  /** Active CPU-hours over the period. */
  cpuHours: number;
  /** Tool calls over the period. */
  calls: number;
  computeMicros: number;
  callsMicros: number;
  totalMicros: number;
  /** Days the sign-up credit lasts at this rate (Infinity when nothing is used). */
  creditDays: number;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/**
 * Monthly cost of a usage profile on small servers, in integer micro-euros,
 * from the public price list: servers × hours a day × CPU share × days ×
 * price per active CPU-hour, plus calls a day × days × price per call. Inputs are clamped to
 * what the product allows (1–50 servers, 0–24 h, 0–10M calls a day).
 */
export function estimateMonthly(
  input: EstimateInput,
  table: PublicPriceTable = PRICE_TABLE
): Estimate {
  const days = clamp(input.days ?? ESTIMATE_DAYS, 1, 31);
  const servers = Math.floor(clamp(input.servers, 1, PLAN_CAPABILITIES.pro.servers));
  const hours = clamp(input.hoursPerDay, 0, 24);
  const share = clamp(input.cpuShare, 0, 1);
  const callsPerDay = Math.floor(clamp(input.callsPerDay, 0, 10_000_000));

  const cpuHours = servers * hours * share * days;
  const calls = callsPerDay * days;
  // Small-box rate: the only per-CPU-hour price the list quotes.
  const computeMicros = eurToMicros(cpuHours * table.cpuHourEur.small);
  const callsMicros = eurToMicros((calls * table.per1000CallsEur) / 1000);
  const totalMicros = computeMicros + callsMicros;
  const perDay = totalMicros / days;
  const creditDays = perDay > 0 ? eurToMicros(table.signupCreditEur) / perDay : Infinity;
  return { cpuHours, calls, computeMicros, callsMicros, totalMicros, creditDays };
}

/** A micro-euro amount for the estimator: "€1.23" / "1,23 €". */
export function formatMicrosEur(micros: number, locale: Locale = "en"): string {
  return formatMicros(micros, locale).replace(/ /g, " ");
}

/**
 * Phrases that described the retired subscription model. No TwinMCP pricing
 * surface may say them any more (src/__tests__/marketing-truth.test.ts).
 */
export const RETIRED_PRICING_PHRASES: readonly RegExp[] = [
  /flat price/i,
  /flat monthly/i,
  /no usage meters?/i,
  /30-day trial/i,
  /free month/i,
  /month free/i,
  /Pro plan €?14[.,]99/i,
  /14[.,]99/,
  /prix fixe/i,
  /sans facturation à l’usage/i,
  /mois offert/i,
  /essai de 30 jours/i,
  // A euro price per month is a subscription price ($ figures are competitors').
  /€\s?\d[\d.,]*\s*(?:\/\s*mo\b|a month|per month)/i,
  /\d[\d\s.,]*\s?€\s*(?:\/\s*mois|par mois)/i,
];
