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

// Stub entry — replace promotionCodeId + handle after running
// scripts/create-promo-code.ts. Slug becomes the public URL: /p/<slug>.
export const CREATORS: CreatorCampaign[] = [
  {
    slug: "youtuber",
    displayName: "YouTuber Partner",
    handle: "@youtuber",
    channelUrl: "https://youtube.com/@youtuber",
    promotionCodeId: process.env.STRIPE_PROMO_YOUTUBER_ID ?? "",
    humanCode: "YT-1MOIS",
    plan: "pro",
    cadence: "monthly",
    freeMonths: 1,
    hero: {
      en: {
        eyebrow: "Partner offer",
        title: "1 month of TwinMCP Pro, on us.",
        description:
          "Spin up to 50 MCP servers on any box size, publish your own MCPs, and ship with your AI agent in production — first month free, cancel anytime.",
        bullets: [
          "50 servers",
          "All box sizes (small, medium, large)",
          "5,000 MCP requests / day",
          "Publish your own MCPs",
        ],
      },
      fr: {
        eyebrow: "Offre partenaire",
        title: "1 mois de TwinMCP Pro offert.",
        description:
          "Lancez jusqu’à 50 serveurs MCP sur toutes les tailles de box, publiez vos propres MCP et passez en production avec votre agent IA. Premier mois offert, sans engagement.",
        bullets: [
          "50 serveurs",
          "Toutes les tailles de box (small, medium, large)",
          "5 000 requêtes MCP par jour",
          "Publiez vos propres MCP",
        ],
      },
    },
  },
];

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
