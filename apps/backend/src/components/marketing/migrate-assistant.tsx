import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { OFFICIAL_MCPS } from "@/lib/servers/seed-catalog";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { migrationCatalogue } from "@/lib/migrate/smithery";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { offerCopy } from "@/components/marketing/offer-badge";
import { MIGRATION_PATHS } from "@/components/marketing/smithery-migration";
import { SmitheryMigrator } from "@/components/marketing/smithery-migrator";
import type { Locale } from "@/lib/i18n/locales";

// The Smithery migration assistant page body (EN /migrate, FR /fr/migrer): a
// short hero and the paste-and-plan tool. Short URLs on purpose, so they can be
// pasted into a forum reply. The full migration guide stays at MIGRATION_PATHS.
//
// The catalogue comes from the seed (the MCPs a user can really install) and
// the offer copy from the wallet facts, so the tool cannot promise an MCP or a
// price that does not exist.

export { ASSISTANT_PATHS } from "@/lib/migrate/paths";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";
const CATALOGUE = migrationCatalogue(OFFICIAL_MCPS, PROMO_EXCLUDED_MCP_SLUGS);

export const ASSISTANT_COPY = {
  en: {
    title: "Migrate your Smithery server in 5 minutes",
    description:
      "Paste your Smithery server URL, name, command or smithery.yaml and get your TwinMCP migration plan: the matching catalogue MCP, the fields to fill in and your new URL.",
    eyebrow: "Smithery migration assistant",
    h1: "Paste your Smithery server. Get your migration plan.",
    lead: "Smithery’s hosting has stopped. Paste whatever you have, and we tell you exactly how to run the same server on TwinMCP: which MCP to install, what to fill in, and the URL to put in your client.",
    guide: "Read the full migration guide",
  },
  fr: {
    title: "Migre ton serveur Smithery en 5 minutes",
    description:
      "Colle l’URL, le nom, la commande ou le smithery.yaml de ton serveur Smithery et obtiens ton plan de migration vers TwinMCP : le MCP du catalogue qui correspond, les champs à remplir et ta nouvelle URL.",
    eyebrow: "Assistant de migration Smithery",
    h1: "Colle ton serveur Smithery. Obtiens ton plan de migration.",
    lead: "L’hébergement de Smithery s’est arrêté. Colle ce que tu as sous la main, et on te dit exactement comment faire tourner le même serveur sur TwinMCP : quel MCP installer, quoi remplir, et l’URL à mettre dans ton client.",
    guide: "Lire le guide de migration complet",
  },
} as const;

export function MigrateAssistant({ locale = "en" }: { locale?: Locale }) {
  const t = ASSISTANT_COPY[locale];
  const offer = offerCopy(locale);
  const nb = locale === "fr" ? (s: string) => s.replace(/ ([:;!?»])/g, " $1") : (s: string) => s;
  return (
    <section className="w-full py-12 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {t.h1}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {nb(t.lead)}
          </p>
        </div>
        <div className="mt-10">
          <SmitheryMigrator
            locale={locale}
            catalogue={CATALOGUE}
            siteUrl={SITE_URL}
            offer={{
              cta: offer.cta,
              termsLine: offer.termsLine,
              signUpHref: offer.signUpHref,
              minTopup: walletFacts(locale).minTopup,
            }}
          />
        </div>
        <p className="mt-10 text-center text-sm">
          <Link
            href={MIGRATION_PATHS[locale] as Route}
            className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
          >
            {t.guide}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  );
}
