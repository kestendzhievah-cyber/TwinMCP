import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/locales";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { HeroMockup } from "./hero-mockup";

// The offer, in both languages. The hero and the closing block read the same
// table so the promise, the CTA and the risk reversal never drift apart. The
// headline leads with the real edge: ANY MCP server — catalogue, stdio, or the
// user's own npm/PyPI package — runs in its own sandbox behind one Streamable
// HTTP URL that every client can reach. Every fact here is one the product
// backs (prepaid wallet, prices from lib/wallet/pricing.ts: at zero, calls
// stop; nothing is billed beyond the balance).
const EN = walletFacts("en");
const FR = walletFacts("fr");

const COPY = {
  en: {
    eyebrow: "Managed MCP hosting",
    titleLead: "Any MCP server, hosted.",
    titleTail: "Reachable from every AI client.",
    lead: "Stdio servers included: pick from a catalogue of 70+ or, once your account is funded, bring your own npm or PyPI package. Each runs in an isolated sandbox behind one URL. Configure once, switch IDEs without reinstalling. Pay only for what you use, from a prepaid balance that stops at zero.",
    primary: `Start with ${EN.signupCredit} free`,
    secondary: "Guided setup",
    reassurance: `${EN.signupCredit} of free credit · No card · Ready in about 2 minutes`,
    finalEyebrow: "Start now",
    finalTitle: "Your first hosted MCP server, live in about 2 minutes",
    finalBody: `Every new account gets ${EN.signupCredit} of free credit, valid ${EN.signupDays} days, no card: ${EN.creditServers} server with up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs.`,
    finalSecondary: "See pricing",
    finalReassurance:
      "No subscription · pay only for what you use · stops at zero, no surprise bills",
    signUp: "/sign-up",
    guidedSetup: "/demo",
  },
  fr: {
    eyebrow: "Hébergement MCP clé en main",
    titleLead: "N’importe quel serveur MCP, hébergé.",
    titleTail: "Accessible depuis tous vos clients IA.",
    lead: "Serveurs stdio compris : choisissez dans un catalogue de plus de 70 MCP ou, une fois votre compte alimenté, apportez votre propre paquet npm ou PyPI. Chacun tourne dans un sandbox isolé, derrière une seule URL. Configurez une fois, changez d’IDE sans rien réinstaller. Vous ne payez que ce que vous utilisez, depuis un solde prépayé qui s’arrête à zéro.",
    primary: `Démarrer avec ${FR.signupCredit} offerts`,
    secondary: "Installation accompagnée",
    reassurance: `${FR.signupCredit} de crédit offert · Sans carte · Prêt en 2 minutes environ`,
    finalEyebrow: "Lancez-vous",
    finalTitle: "Votre premier serveur MCP hébergé, en ligne en 2 minutes environ",
    finalBody: `Chaque nouveau compte reçoit ${FR.signupCredit} de crédit offert, valable ${FR.signupDays} jours, sans carte : ${FR.creditServers} serveur avec jusqu’à ${FREE_MCP_LIMIT} MCP plus TwinMCP Docs.`,
    finalSecondary: "Voir les tarifs",
    finalReassurance:
      "Sans abonnement · vous payez ce que vous utilisez · arrêt à zéro, aucune facture surprise",
    signUp: "/fr/inscription",
    guidedSetup: "/fr/demo",
  },
} as const;

// Hero eyebrow between two short hairlines (DESIGN.md §4.7). The rules are
// hidden below `sm` so the line never wraps between them on phones.
const HERO_EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:hidden before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:hidden after:h-px after:w-10 after:shrink-0 after:bg-border after:content-[''] sm:before:block sm:after:block";

// The home hero is the centre of the card: a dateline eyebrow between two
// hairlines, the name engraved in letterspaced small capitals, a short rule,
// the lead, one dominant button with its risk reversal right under it (the
// small-caps address line of facts) and a quiet secondary action (the guided
// setup request page, /demo · /fr/demo). The
// compatible clients are listed once, by the IdeLogosBar band right below.
// The product — the dashboard mockup — sits under it on a stack of cards. The
// display size is held to two lines so the CTA and the top of the product stay
// above the fold at 1440×900 and 390×844.
//
// CTA clicks are reported by the marketing header's delegated listener (any
// element with `data-cta-location`), so this stays a server component.
export function Hero({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8 sm:pt-12 md:pb-24 md:pt-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className={HERO_EYEBROW_RULES}>{t.eyebrow}</p>

          <h1 className="display letterpress mt-5 text-3xl sm:text-5xl md:mt-6 lg:text-6xl">
            {t.titleLead} <span className="sm:block">{t.titleTail}</span>
          </h1>

          <div aria-hidden className="mt-5 h-px w-12 bg-foreground/40 md:mt-6" />

          <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:mt-6 md:text-xl">
            {t.lead}
          </p>

          {/* One DOM order for both layouts: on phones the risk reversal sits
              right under the primary button and the secondary comes last; from
              `sm` the two buttons share a row and the reassurance line wraps
              under them (order + basis-full). */}
          <div className="mt-7 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center md:mt-8">
            <Button
              asChild
              size="lg"
              className="w-full max-w-xs sm:order-1 sm:w-auto sm:max-w-none"
            >
              <Link href={t.signUp as Route} data-cta-location="hero_primary">
                {t.primary}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="smallcaps tracking-sc lining text-xs text-muted-foreground sm:order-3 sm:basis-full">
              {t.reassurance}
            </p>
            <Button asChild size="lg" variant="ghost" className="sm:order-2">
              <Link href={t.guidedSetup as Route} data-cta-location="hero_secondary">
                {t.secondary}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 flex justify-center md:mt-12">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

// The closing block restates the offer and the risk reversal: one ink-ruled
// card, a serif title, the italic offer line, the dominant button and a quiet
// link to the plans.
export function FinalCta({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <section className="rule-double py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl border border-foreground/60 bg-card px-6 py-10 text-center sm:px-10 md:p-14">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']">
            {t.finalEyebrow}
          </p>
          <h2 className="mt-4 text-2xl font-medium md:text-3xl">{t.finalTitle}</h2>
          <p className="mt-3 text-base italic text-muted-foreground">{t.finalBody}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full max-w-xs sm:w-auto sm:max-w-none">
              <Link href={t.signUp as Route} data-cta-location="final">
                {t.primary}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link
                href={(locale === "fr" ? "/fr/tarifs" : "/plans") as Route}
                data-cta-location="final_secondary"
              >
                {t.finalSecondary}
              </Link>
            </Button>
          </div>
          {/* Quiet third way in for teams that want it done for them (K3: /demo · /fr/demo). */}
          <p className="mt-5 text-sm text-muted-foreground">
            {locale === "fr"
              ? "Vous préférez qu’on l’installe pour vous ? "
              : "Rather have it set up for you? "}
            <Link
              href={t.guidedSetup as Route}
              data-cta-location="final_guided_setup"
              className="text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
            >
              {t.secondary}
            </Link>
          </p>
          <p className="smallcaps tracking-sc lining mt-5 text-xs text-muted-foreground">
            {t.reassurance}
          </p>
          <p className="smallcaps tracking-sc mt-1 text-xs text-muted-foreground">
            {t.finalReassurance}
          </p>
        </div>
      </div>
    </section>
  );
}
