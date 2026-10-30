// Registry of creator/influencer collaborations.
//
// Each entry powers a landing page at /p/[slug] (EN) and /fr/p/[slug] (FR),
// and pre-applies its Stripe promotion code in the checkout. Adding a new
// partner is a one-file change: run scripts/create-promo-code.ts, then
// append an entry here.

import type { BillablePlan, Cadence } from "@/lib/stripe";
import type { Locale } from "@/lib/i18n/locales";

/** Promos only ever discount Pro: it is the one paid plan on sale. Team stays a
 *  BillablePlan for grandfathered subscribers but can't be promoted. */
export type PromoPlan = Extract<BillablePlan, "pro">;

export interface HeroContent {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
}

export interface CreatorCampaign {
  slug: string;
  displayName: string;
  handle?: string;
  channelUrl?: string;
  /** Stripe promotion_code id (promo_xxx), NOT the human-readable code. */
  promotionCodeId: string;
  /** The human-readable code we show on the landing page (e.g. YT-NOM-1MOIS). */
  humanCode: string;
  plan: PromoPlan;
  cadence: Cadence;
  /** Per-locale marketing copy. Both locales are required so the language
   *  switcher always has somewhere to go. */
  hero: Record<Locale, HeroContent>;
  /** Free months unlocked by the code, used for copy ("1 month free"). */
  freeMonths: number;
  /** Optional expiry shown on the landing page. */
  expiresAt?: string;
}

// Retired 2026-10-29: these campaigns were Stripe coupons on the Pro
// subscription, which no longer exists (prepaid wallet). With no entry, every
// /p/<slug> landing 404s. A future partner offer would be a wallet credit
// (ledger kind 'admin_grant'), not a coupon, and needs its own design.
export const CREATORS: CreatorCampaign[] = [];

export function getCreator(slug: string): CreatorCampaign | undefined {
  const c = CREATORS.find((x) => x.slug === slug);
  // Hide unconfigured stubs in production so the landing 404s instead of
  // surfacing a broken checkout.
  if (!c || !c.promotionCodeId) return undefined;
  return c;
}

export function listCreatorSlugs(): string[] {
  return CREATORS.filter((c) => c.promotionCodeId).map((c) => c.slug);
}
