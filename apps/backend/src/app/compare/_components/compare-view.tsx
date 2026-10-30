import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq } from "@/components/marketing/faq";
import {
  CATALOGUE_COUNT,
  CHECKED_ON,
  COMPARISONS,
  comparePath,
  formatCheckedOn,
  sourceNumber,
  type Comparison,
  type CompareRow,
} from "@/lib/compare/data";
import type { Locale } from "@/lib/i18n/locales";

// The /compare hub and its pages (EN /compare, FR /fr/comparer). Rendering
// only: every fact, source and path comes from lib/compare/data.ts. The page
// files add metadata and JSON-LD.

const COPY = {
  en: {
    home: "Home",
    hub: "Compare",
    hubEyebrow: "Compare",
    hubTitle: "TwinMCP, compared honestly",
    hubLead:
      "Three ways to give your AI client MCP tools, set against TwinMCP. Each page says what the other option does better, links its sources, and dates them.",
    hubFacts: ["Sourced facts", "No ratings", "Checked"],
    cardsEyebrow: "Comparisons",
    cardsTitle: "Pick the comparison that matches your question",
    read: "Read the comparison",
    isTitle: "What TwinMCP is, and is not",
    isEyebrow: "In plain terms",
    isHeading: "TwinMCP is",
    isNotHeading: "TwinMCP is not",
    is: [
      "A host for MCP servers: each server you create runs in its own isolated micro-VM.",
      `A catalogue of ${CATALOGUE_COUNT} MCP servers, plus your own npm or PyPI packages once your account is funded, stdio included.`,
      "One URL per MCP or per server, with API keys you can limit to the MCP proxy.",
      "Pay as you go from a prepaid balance: tool calls and compute are charged, there is no subscription, and calls stop at zero.",
    ],
    isNot: [
      "A SaaS integration platform with managed OAuth for your end users.",
      "Certified, or backed by an SLA.",
      "A place to choose the region your servers run in.",
      "An open registry of every MCP server published.",
    ],
    side: "Side by side",
    sideTitle: (them: string) => `${them} and TwinMCP, criterion by criterion`,
    sideNote: "Numbers in brackets point to the sources at the bottom of the page.",
    criterion: "Criterion",
    chooseEyebrow: "The honest answer",
    chooseTitle: "Which one should you choose?",
    chooseUs: "Choose TwinMCP if…",
    faqEyebrow: "FAQ",
    faqTitle: "Questions people ask",
    faqDescription: "Something missing or out of date? Write to hello@twinmcp.fr.",
    sourcesEyebrow: "Sources",
    sourcesTitle: "Where the facts come from",
    checked: (date: string) => `checked ${date}`,
    sourcesNote:
      "Third-party facts are quoted or paraphrased from the pages below, as they read on the date shown. TwinMCP facts come from its own plans and code. If a source has changed, the source wins: tell us at hello@twinmcp.fr and we will correct this page.",
    relatedTitle: "Further reading",
    otherTitle: "Other comparisons",
    finalTitle: "Try it on a real server",
    finalLead:
      "You start on free credit, with no card. If you would rather be walked through it, book a guided setup.",
    start: "Start free",
    demo: "Guided setup",
    signUp: "/sign-up?plan=free",
    demoHref: "/demo",
    homeHref: "/",
  },
  fr: {
    home: "Accueil",
    hub: "Comparer",
    hubEyebrow: "Comparer",
    hubTitle: "TwinMCP, comparé honnêtement",
    hubLead:
      "Trois façons de donner des outils MCP à votre client IA, mises face à TwinMCP. Chaque page dit ce que l’autre option fait mieux, cite ses sources et les date.",
    hubFacts: ["Faits sourcés", "Aucune note", "Vérifié le"],
    cardsEyebrow: "Comparatifs",
    cardsTitle: "Choisissez le comparatif qui répond à votre question",
    read: "Lire le comparatif",
    isTitle: "Ce que TwinMCP est, et n’est pas",
    isEyebrow: "Sans détour",
    isHeading: "TwinMCP est",
    isNotHeading: "TwinMCP n’est pas",
    is: [
      "Un hébergeur de serveurs MCP : chaque serveur que vous créez tourne dans sa propre micro-VM isolée.",
      `Un catalogue de ${CATALOGUE_COUNT} serveurs MCP, plus vos propres paquets npm ou PyPI une fois votre compte rechargé, stdio compris.`,
      "Une URL par MCP ou par serveur, avec des clés API limitables au proxy MCP.",
      "Un paiement à l’usage sur un solde prépayé : appels d’outils et calcul sont facturés, sans abonnement, et les appels s’arrêtent à zéro.",
    ],
    isNot: [
      "Une plateforme d’intégration SaaS avec OAuth géré pour vos utilisateurs finaux.",
      "Certifié, ni adossé à un SLA.",
      "Un service où choisir la région de vos serveurs.",
      "Un registre ouvert de tous les serveurs MCP publiés.",
    ],
    side: "Côte à côte",
    sideTitle: (them: string) => `${them} et TwinMCP, critère par critère`,
    sideNote: "Les numéros entre crochets renvoient aux sources en bas de page.",
    criterion: "Critère",
    chooseEyebrow: "La réponse honnête",
    chooseTitle: "Lequel choisir ?",
    chooseUs: "Choisissez TwinMCP si…",
    faqEyebrow: "FAQ",
    faqTitle: "Les questions qu’on nous pose",
    faqDescription: "Une question manque ou une info a vieilli ? Écrivez à hello@twinmcp.fr.",
    sourcesEyebrow: "Sources",
    sourcesTitle: "D’où viennent les faits",
    checked: (date: string) => `vérifié le ${date}`,
    sourcesNote:
      "Les faits sur les tiers sont cités ou résumés à partir des pages ci-dessous, telles qu’elles se lisaient à la date indiquée. Les faits sur TwinMCP viennent de ses offres et de son code. Si une source a changé, la source fait foi : signalez-le à hello@twinmcp.fr et nous corrigerons cette page.",
    relatedTitle: "Pour aller plus loin",
    otherTitle: "Les autres comparatifs",
    finalTitle: "Essayez sur un vrai serveur",
    finalLead:
      "Vous démarrez avec du crédit offert, sans carte bancaire. Si vous préférez être guidé, réservez une installation accompagnée.",
    start: "Commencer gratuitement",
    demo: "Installation accompagnée",
    signUp: "/fr/inscription?plan=free",
    demoHref: "/fr/demo",
    homeHref: "/fr",
  },
} as const;

const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']";

function sourceAnchor(id: string): string {
  return `source-${id}`;
}

// ─── Shared pieces ─────────────────────────────────────────────────────────────

function Breadcrumbs({ locale, current }: { locale: Locale; current?: string }) {
  const t = COPY[locale];
  return (
    <nav
      aria-label={locale === "fr" ? "Fil d’Ariane" : "Breadcrumb"}
      className="smallcaps tracking-sc mx-auto max-w-6xl px-4 pt-8 text-xs text-muted-foreground sm:px-6"
    >
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href={t.homeHref as Route} className="hover:text-foreground">
            {t.home}
          </Link>
        </li>
        <li aria-hidden>·</li>
        {current ? (
          <>
            <li>
              <Link href={comparePath(locale) as Route} className="hover:text-foreground">
                {t.hub}
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              {current}
            </li>
          </>
        ) : (
          <li aria-current="page" className="text-foreground">
            {t.hub}
          </li>
        )}
      </ol>
    </nav>
  );
}

function Hero({
  locale,
  eyebrow,
  title,
  lead,
  facts,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  lead: string;
  facts: string[];
}) {
  const t = COPY[locale];
  return (
    <section className="w-full px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-16">
      <div className="mx-auto max-w-4xl text-center">
        <p className={EYEBROW_RULES}>{eyebrow}</p>
        <h1 className="display letterpress mt-6 text-balance text-4xl md:text-5xl lg:text-6xl">
          {title}
        </h1>
        <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" aria-hidden />
        <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">{lead}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={t.signUp as Route} data-cta-location="compare_hero">
              {t.start}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href={t.demoHref as Route} data-cta-location="compare_hero_demo">
              {t.demo}
            </Link>
          </Button>
        </div>
        <p className="smallcaps tracking-sc lining mt-10 text-xs text-muted-foreground">
          {facts.join(" · ")}
        </p>
      </div>
    </section>
  );
}

function FinalCta({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <section className="rule-double w-full px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-medium md:text-4xl">{t.finalTitle}</h2>
        <p className="mt-4 text-lg text-muted-foreground">{t.finalLead}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={t.signUp as Route} data-cta-location="compare_final">
              {t.start}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={t.demoHref as Route} data-cta-location="compare_final_demo">
              {t.demo}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ComparisonCards({ locale, exclude }: { locale: Locale; exclude?: string }) {
  const t = COPY[locale];
  const list = COMPARISONS.filter((c) => c.slug !== exclude);
  return (
    <ul className="grid gap-6 md:grid-cols-3">
      {list.map((c) => (
        <li key={c.slug}>
          <Link
            href={comparePath(locale, c) as Route}
            className="group flex h-full flex-col border border-border bg-card p-6 transition-colors hover:border-foreground/60"
          >
            <span className="eyebrow">{c.eyebrow[locale]}</span>
            <span className="smallcaps tracking-sc mt-3 text-lg font-medium">{c.them[locale]}</span>
            <span className="mt-2 flex-1 text-base text-muted-foreground">{c.summary[locale]}</span>
            <span className="smallcaps tracking-sc mt-6 inline-flex items-center gap-2 text-sm text-foreground">
              {t.read}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ─── Hub ───────────────────────────────────────────────────────────────────────

export function CompareHub({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const checked = formatCheckedOn(CHECKED_ON, locale);
  return (
    <>
      <Breadcrumbs locale={locale} />
      <Hero
        locale={locale}
        eyebrow={t.hubEyebrow}
        title={t.hubTitle}
        lead={t.hubLead}
        facts={[t.hubFacts[0], t.hubFacts[1], `${t.hubFacts[2]} ${checked}`]}
      />

      <Section bordered eyebrow={t.cardsEyebrow} title={t.cardsTitle}>
        <ComparisonCards locale={locale} />
      </Section>

      <Section bordered eyebrow={t.isEyebrow} title={t.isTitle}>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="border border-border bg-card p-6">
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.isHeading}</h3>
            <ul className="mt-4 space-y-3 text-base text-muted-foreground">
              {t.is.map((line) => (
                <li key={line} className="border-l-2 border-l-success pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-border bg-card p-6">
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.isNotHeading}</h3>
            <ul className="mt-4 space-y-3 text-base text-muted-foreground">
              {t.isNot.map((line) => (
                <li key={line} className="border-l-2 border-l-border pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <FinalCta locale={locale} />
    </>
  );
}

// ─── One comparison ────────────────────────────────────────────────────────────

function SourceMarks({ comparison, row }: { comparison: Comparison; row: CompareRow }) {
  if (row.sources.length === 0) return null;
  return (
    <>
      {row.sources.map((id) => {
        const num = sourceNumber(comparison, id);
        if (!num) return null;
        return (
          <a
            key={id}
            href={`#${sourceAnchor(id)}`}
            className="lining ml-1 align-super text-xs text-brand no-underline hover:underline"
          >
            [{num}]
          </a>
        );
      })}
    </>
  );
}

// The ledger: a real table from md up; under md every row stacks into a block
// (criterion, then each option with its own small-caps label) so nothing
// scrolls sideways at 375 px.
function Ledger({ locale, comparison }: { locale: Locale; comparison: Comparison }) {
  const t = COPY[locale];
  const them = comparison.them[locale];
  return (
    <table className="lining block w-full text-left text-base md:table">
      <caption className="sr-only">{t.sideTitle(them)}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b border-foreground/50">
          <th
            scope="col"
            className="smallcaps tracking-sc h-10 w-1/5 px-3 text-xs font-medium text-muted-foreground"
          >
            {t.criterion}
          </th>
          <th
            scope="col"
            className="smallcaps tracking-sc h-10 w-2/5 px-3 text-xs font-medium text-muted-foreground"
          >
            {them}
          </th>
          <th
            scope="col"
            className="smallcaps tracking-sc h-10 w-2/5 px-3 text-xs font-medium text-foreground"
          >
            TwinMCP
          </th>
        </tr>
      </thead>
      <tbody className="block border-t border-foreground/50 md:table-row-group md:border-t-0">
        {comparison.rows.map((row) => (
          <tr
            key={row.id}
            className="block border-b border-border py-5 md:table-row md:py-0 md:last:border-b-0"
          >
            <th
              scope="row"
              className="smallcaps tracking-sc block text-sm font-medium text-foreground md:table-cell md:p-3 md:align-top"
            >
              {row.criterion[locale]}
            </th>
            <td className="mt-3 block text-muted-foreground md:mt-0 md:table-cell md:p-3 md:align-top">
              <span className="smallcaps tracking-sc block text-xs text-muted-foreground md:hidden">
                {them}
              </span>
              {row.them[locale]}
              <SourceMarks comparison={comparison} row={row} />
            </td>
            <td className="mt-3 block text-foreground md:mt-0 md:table-cell md:p-3 md:align-top">
              <span className="smallcaps tracking-sc block text-xs text-muted-foreground md:hidden">
                TwinMCP
              </span>
              {row.twinmcp[locale]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CompareDetail({ locale, comparison }: { locale: Locale; comparison: Comparison }) {
  const t = COPY[locale];
  const them = comparison.them[locale];
  const checked = formatCheckedOn(CHECKED_ON, locale);
  const notice = comparison.notice?.[locale];
  const facts =
    locale === "fr"
      ? [
          `${comparison.sources.length} source${comparison.sources.length > 1 ? "s" : ""}`,
          `Vérifié le ${checked}`,
          "Aucune note",
        ]
      : [
          `${comparison.sources.length} source${comparison.sources.length > 1 ? "s" : ""}`,
          `Checked ${checked}`,
          "No ratings",
        ];

  return (
    <>
      <Breadcrumbs locale={locale} current={them} />
      <Hero
        locale={locale}
        eyebrow={comparison.eyebrow[locale]}
        title={comparison.headline[locale]}
        lead={comparison.lead[locale]}
        facts={facts}
      />

      <Section
        bordered
        id="side-by-side"
        eyebrow={t.side}
        title={t.sideTitle(them)}
        description={t.sideNote}
      >
        {notice && (
          <div className="mx-auto mb-10 flex max-w-4xl flex-col gap-2 border border-l-2 border-info/40 border-l-info bg-info/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{notice.text}</span>
            {notice.link && (
              <Link
                href={notice.link.href as Route}
                className="smallcaps tracking-sc inline-flex shrink-0 items-center gap-1.5 text-info hover:underline"
              >
                {notice.link.label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
        <div className="mx-auto max-w-5xl">
          <Ledger locale={locale} comparison={comparison} />
        </div>
      </Section>

      <Section bordered eyebrow={t.chooseEyebrow} title={t.chooseTitle}>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className="border border-border bg-card p-6">
            <h3 className="smallcaps tracking-sc text-lg font-medium">
              {comparison.chooseThemTitle[locale]}
            </h3>
            <ul className="mt-4 space-y-3 text-base text-muted-foreground">
              {comparison.chooseThem[locale].map((line) => (
                <li key={line} className="border-l-2 border-l-border pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-foreground/60 bg-card p-6">
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.chooseUs}</h3>
            <ul className="mt-4 space-y-3 text-base text-muted-foreground">
              {comparison.chooseTwinmcp[locale].map((line) => (
                <li key={line} className="border-l-2 border-l-foreground/60 pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Faq
        locale={locale}
        id="faq"
        variant="list"
        items={comparison.faq[locale]}
        eyebrow={t.faqEyebrow}
        title={t.faqTitle}
        description={t.faqDescription}
      />

      <Section bordered id="sources" eyebrow={t.sourcesEyebrow} title={t.sourcesTitle}>
        <div className="mx-auto max-w-3xl">
          <ol className="divide-y divide-border border-y border-border">
            {comparison.sources.map((s, i) => (
              <li
                key={s.id}
                id={sourceAnchor(s.id)}
                className="flex scroll-mt-24 flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="lining shrink-0 text-sm text-muted-foreground">[{i + 1}]</span>
                <span className="min-w-0 flex-1">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                  >
                    {s.label}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                  <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                    {s.url}
                  </span>
                </span>
                <span className="lining shrink-0 text-xs italic text-muted-foreground">
                  {t.checked(formatCheckedOn(s.checkedOn, locale))}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm italic text-muted-foreground">{t.sourcesNote}</p>

          <h3 className="smallcaps tracking-sc mt-12 text-lg font-medium">{t.relatedTitle}</h3>
          <ul className="mt-4 space-y-2">
            {comparison.related[locale].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href as Route}
                  className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section bordered eyebrow={t.otherTitle}>
        <ComparisonCards locale={locale} exclude={comparison.slug} />
      </Section>

      <FinalCta locale={locale} />
    </>
  );
}
