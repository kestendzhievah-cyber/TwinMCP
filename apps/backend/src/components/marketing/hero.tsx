import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/locales";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { HeroConfigCard } from "./hero-config-card";
import { OfferBadge, OfferTerms, offerCopy } from "./offer-badge";

// The offer, in both languages. The hero and the closing block read the same
// table so the promise, the CTA and the terms never drift apart. The €10 shows
// four times above the fold (badge, H1, CTA, terms line) and every figure comes
// from the wallet facts (components/pricing/wallet-copy.ts): at zero, calls
// stop; nothing is billed beyond the balance.
const EN = walletFacts("en");
const FR = walletFacts("fr");

const COPY = {
  en: {
    titleLead: "Host any MCP server.",
    titleBefore: "Start with ",
    titleAccent: `${EN.signupCredit} free`,
    titleAfter: ".",
    lead: "70+ ready-to-run MCPs, stdio included, each in its own isolated sandbox behind one URL. Paste it into Cursor, Claude, VS Code or any MCP client, and you’re live in about 2 minutes.",
    secondary: "Browse 70+ MCPs",
    catalogue: "/servers",
    finalTitle: "Your first hosted MCP server, live in about 2 minutes.",
    finalBody: `Every new account gets ${EN.signupCredit} of free credit, valid ${EN.signupDays} days, no card: ${EN.creditServers} server with up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs.`,
    finalSecondary: "See pricing",
    pricing: "/plans",
    guidedLead: "Rather have it set up for you? ",
    guided: "Guided setup",
    guidedSetup: "/demo",
  },
  fr: {
    titleLead: "Hébergez n’importe quel serveur MCP.",
    titleBefore: "",
    titleAccent: `${FR.signupCredit} offerts`,
    titleAfter: " pour démarrer.",
    lead: "Plus de 70 MCP prêts à l’emploi, stdio compris, chacun dans son propre sandbox isolé derrière une seule URL. Collez-la dans Cursor, Claude, VS Code ou tout client MCP : c’est en ligne en 2 minutes environ.",
    secondary: "Voir les 70+ MCP",
    catalogue: "/fr/serveurs",
    finalTitle: "Votre premier serveur MCP hébergé, en ligne en 2 minutes environ.",
    finalBody: `Chaque nouveau compte reçoit ${FR.signupCredit} de crédit offert, valable ${FR.signupDays} jours, sans carte : ${FR.creditServers} serveur avec jusqu’à ${FREE_MCP_LIMIT} MCP plus TwinMCP Docs.`,
    finalSecondary: "Voir les tarifs",
    pricing: "/fr/tarifs",
    guidedLead: "Vous préférez qu’on l’installe pour vous ? ",
    guided: "Installation accompagnée",
    guidedSetup: "/fr/demo",
  },
} as const;

// Copy column (badge, H1, lead, CTAs, terms) on the left from lg, the config
// card on the right; below lg everything stacks, centred, with the card after
// the CTA block so badge → terms stay above the fold at 390×844 and 1440×900.
//
// `#hero-cta` is what the sticky mobile CTA watches. CTA clicks are reported by
// the marketing header's delegated listener (any element with
// `data-cta-location`), so this stays a server component.
export function Hero({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const o = offerCopy(locale);
  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="flex min-w-0 flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
          <OfferBadge locale={locale} />

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t.titleLead}
            <br />
            {t.titleBefore}
            <span className="text-primary">{t.titleAccent}</span>
            {t.titleAfter}
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted-foreground md:text-xl">{t.lead}</p>

          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link id="hero-cta" href={o.signUpHref as Route} data-cta-location="hero_primary">
                {o.cta}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href={t.catalogue as Route} data-cta-location="hero_secondary">
                {t.secondary}
              </Link>
            </Button>
          </div>

          <OfferTerms locale={locale} className="mt-5 lg:justify-start" />
        </div>

        <div className="min-w-0 lg:col-span-5">
          <HeroConfigCard locale={locale} />
        </div>
      </div>
    </section>
  );
}

// The closing block restates the offer and the terms on the surface-band (no
// navy panel: a rose button on navy fails contrast). Its section is marked
// `data-sticky-cta-hide`, so the sticky mobile bar steps aside while it shows.
export function FinalCta({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const o = offerCopy(locale);
  return (
    <section data-sticky-cta-hide className="bg-background py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl bg-surface-band p-8 text-center md:p-14">
          <OfferBadge locale={locale} tone="solid" />
          <h2 className="mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t.finalTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{t.finalBody}</p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link href={o.signUpHref as Route} data-cta-location="final">
                {o.cta}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href={t.pricing as Route} data-cta-location="final_secondary">
                {t.finalSecondary}
              </Link>
            </Button>
          </div>
          {/* Quiet third way in for teams that want it done for them (/demo · /fr/demo). */}
          <p className="mt-5 text-sm text-muted-foreground">
            {t.guidedLead}
            <Link
              href={t.guidedSetup as Route}
              data-cta-location="final_guided_setup"
              className="font-medium text-brand underline underline-offset-4 hover:no-underline"
            >
              {t.guided}
            </Link>
          </p>
          <OfferTerms locale={locale} className="mt-5" />
        </div>
      </div>
    </section>
  );
}
