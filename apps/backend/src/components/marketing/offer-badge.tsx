import { Check, Gift } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { count, eurAmount, walletFacts } from "@/components/pricing/wallet-copy";
import { cn } from "@/lib/utils";

// The sign-up offer, shared by every surface that states it: the home (hero,
// offer band, final CTA, sticky mobile bar), the auth pages, onboarding and the
// pricing hero. Every number is rendered from the wallet facts
// (components/pricing/wallet-copy.ts → lib/wallet/pricing.ts) and FREE_MCP_LIMIT,
// so no copy can promise more than the ledger grants. Server-safe: no hooks.
//
// The terms line is mandatory wherever the offer is the headline (docs/DESIGN.md,
// "Copy rules"): valid N days, no card, no subscription, stops at zero.

/** Where the offer CTA leads, per locale. */
export const SIGN_UP_PATH: Record<Locale, string> = {
  en: "/sign-up",
  fr: "/fr/inscription",
};

export interface OfferCopy {
  /** The sign-up credit: "€10" / "10 €". */
  credit: string;
  /** Pill text: "€10 free credit · no card" / "10 € offerts · sans carte". */
  badge: string;
  /** Short pill text for tight rows: "€10 free · no card" / "10 € offerts · sans carte". */
  short: string;
  /** The offer CTA label: "Claim my €10 credit" / "Récupérer mes 10 € offerts". */
  cta: string;
  /** The terms, one entry per item (rendered with check marks). */
  terms: readonly string[];
  /** The terms joined with " · ", for plain-text rows. */
  termsLine: string;
  /** Sign-up page of the locale. */
  signUpHref: string;
}

/** Copy of the sign-up offer in `locale`, rendered from the wallet facts. */
export function offerCopy(locale: Locale = "en"): OfferCopy {
  const w = walletFacts(locale);
  const zero = eurAmount(0, locale);
  if (locale === "fr") {
    const terms = [
      `Valable ${w.signupDays} jours`,
      "Sans carte",
      "Sans abonnement",
      `Arrêt à ${zero}, aucune facture surprise`,
    ];
    return {
      credit: w.signupCredit,
      badge: `${w.signupCredit} offerts · sans carte`,
      short: `${w.signupCredit} offerts · sans carte`,
      cta: `Récupérer mes ${w.signupCredit} offerts`,
      terms,
      termsLine: terms.join(" · "),
      signUpHref: SIGN_UP_PATH.fr,
    };
  }
  const terms = [
    `Valid ${w.signupDays} days`,
    "No card",
    "No subscription",
    `Stops at ${zero}, no surprise bills`,
  ];
  return {
    credit: w.signupCredit,
    badge: `${w.signupCredit} free credit · no card`,
    short: `${w.signupCredit} free · no card`,
    cta: `Claim my ${w.signupCredit} credit`,
    terms,
    termsLine: terms.join(" · "),
    signUpHref: SIGN_UP_PATH.en,
  };
}

export interface OfferFactCell {
  /** The key figure: "≈100,000", "≈10.8 h", "1 server". */
  figure: string;
  /** What the figure means, with its unit price. */
  label: string;
}

export interface OfferFactsCopy {
  cells: readonly [OfferFactCell, OfferFactCell, OfferFactCell];
  /** The chips between the cells: "or" (1↔2) and "Included" (2↔3). */
  joiners: readonly [string, string];
  /** Eyebrow and title of the offer band. */
  eyebrow: string;
  title: string;
  /** The mandatory small print under the cells. */
  smallPrint: string;
}

/**
 * What the sign-up credit buys, as three cells. Each figure assumes the whole
 * credit goes to that item (the small print says so); never "€10 of compute":
 * the promo caps make that untrue.
 */
export function offerFacts(locale: Locale = "en"): OfferFactsCopy {
  const w = walletFacts(locale);
  const one = count(1000, locale);
  if (locale === "fr") {
    return {
      eyebrow: "Votre crédit de bienvenue",
      title: `Ce que ${w.signupCredit} vous offrent`,
      cells: [
        {
          figure: `≈${w.creditCalls}`,
          label: `appels d’outils, à ${w.per1000Calls} les ${one}`,
        },
        {
          figure: `≈${w.creditCpuHours.small} h`,
          label: `de CPU actif sur un petit serveur, à ${w.cpuHour.small}/h`,
        },
        {
          figure: `${w.creditServers} ${w.creditServers > 1 ? "serveurs" : "serveur"}`,
          label: `avec jusqu’à ${FREE_MCP_LIMIT} MCP + TwinMCP Docs`,
        },
      ],
      joiners: ["ou", "Inclus"],
      smallPrint: `Chaque chiffre suppose que les ${w.signupCredit} y sont entièrement consacrés ; le temps CPU utilisé par les appels est facturé en plus. Crédit offert valable ${w.signupDays} jours, un par personne, consommé avant le crédit payé. Les MCP qui exécutent des commandes shell, du code ou un navigateur headless se débloquent à la première recharge.`,
    };
  }
  return {
    eyebrow: "Your sign-up credit",
    title: `What ${w.signupCredit} gets you`,
    cells: [
      {
        figure: `≈${w.creditCalls}`,
        label: `tool calls, at ${w.per1000Calls} per ${one}`,
      },
      {
        figure: `≈${w.creditCpuHours.small} h`,
        label: `of active CPU on a small server, at ${w.cpuHour.small}/h`,
      },
      {
        figure: `${w.creditServers} ${w.creditServers > 1 ? "servers" : "server"}`,
        label: `with up to ${FREE_MCP_LIMIT} MCPs + TwinMCP Docs`,
      },
    ],
    joiners: ["or", "Included"],
    smallPrint: `Each figure assumes the whole ${w.signupCredit} goes to that item; CPU time used by tool calls is charged on top. Free credit is valid ${w.signupDays} days, one per person, and is spent before paid credit. MCPs that run shell commands, code or a headless browser unlock with your first top-up.`,
  };
}

export interface OfferBadgeProps {
  locale?: Locale;
  /** "md" (default) for heroes, "sm" for headers and tight rows. */
  size?: "sm" | "md";
  /** "soft" (pink, default) or "solid" (rose fill, for the surface-band). */
  tone?: "soft" | "solid";
  className?: string;
}

/** The €10 pill: "€10 free credit · no card" with a gift icon. */
export function OfferBadge({
  locale = "en",
  size = "md",
  tone = "soft",
  className,
}: OfferBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        tone === "solid"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-offer-border bg-offer text-offer-foreground",
        className
      )}
    >
      <Gift aria-hidden className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {offerCopy(locale).badge}
    </span>
  );
}

/** The mandatory terms line, each term behind a success check. */
export function OfferTerms({ locale = "en", className }: { locale?: Locale; className?: string }) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground",
        className
      )}
    >
      {offerCopy(locale).terms.map((term) => (
        <li key={term} className="inline-flex items-center gap-1.5">
          <Check aria-hidden className="h-4 w-4 shrink-0 text-success" />
          {term}
        </li>
      ))}
    </ul>
  );
}
