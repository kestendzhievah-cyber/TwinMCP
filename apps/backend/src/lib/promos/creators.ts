// Registry of creator/influencer collaborations.
//
// Each entry powers a landing page at /p/[slug] (EN) and /fr/p/[slug] (FR),
// and pre-applies its Stripe promotion code in the checkout. Adding a new
// partner is a one-file change: run scripts/create-promo-code.ts, then
// append an entry here.

import type { BillablePlan, Cadence } from "@/lib/stripe";
import type { Locale } from "@/lib/i18n/locales";

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
  plan: BillablePlan;
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
          "Spin up to 25 MCP servers, publish your own MCPs, and ship with your AI agent in production — first month free, cancel anytime.",
        bullets: [
          "25 hosted MCP servers",
          "Publish private MCPs",
          "Audit logs · 30 days",
          "Priority email support",
        ],
      },
      fr: {
        eyebrow: "Offre partenaire",
        title: "1 mois de TwinMCP Pro offert.",
        description:
          "Provisionne jusqu'à 25 serveurs MCP, publie tes propres MCPs et passe en prod avec ton agent IA — premier mois gratuit, sans engagement.",
        bullets: [
          "25 serveurs MCP hébergés",
          "Publie tes propres MCPs",
          "Audit logs · 30 jours",
          "Support email prioritaire",
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
