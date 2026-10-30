import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq } from "@/components/marketing/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { FUNDED_UNLOCKS, SIGNUP_OFFER, WALLET_SUMMARY } from "@/components/pricing/wallet-copy";
import { getServerBySlug } from "@/lib/servers/catalog";
import { breadcrumbListSchema, faqPageSchema, itemListSchema } from "@/lib/seo/schema";
import type { Locale } from "@/lib/i18n/locales";
import {
  SOLUTIONS,
  SOLUTIONS_INDEX_PATHS,
  guidedSetupHref,
  mcpsNeedingInput,
  signUpHref,
  solutionMcps,
  solutionPath,
  type Solution,
} from "@/lib/solutions/data";

// Segment pages (EN /solutions, FR /fr/solutions). The page files only add
// metadata; all copy lives in lib/solutions/data.ts (facts policy there) and
// the price facts below come from the wallet price list (lib/wallet/pricing.ts
// through components/pricing/wallet-copy.ts), never typed by hand. No SLA,
// region or certification claim.

const PRICING_HREF: Record<Locale, string> = { en: "/plans", fr: "/fr/tarifs" };

const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']";
const LINK =
  "text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

const UI = {
  en: {
    home: "Home",
    solutions: "Solutions",
    indexEyebrow: "Solutions",
    indexTitle: "An MCP stack for each team",
    indexLead:
      "Starting packs of hosted MCP servers, each aimed at one kind of team. Install a pack yourself on your free credit, or have us set it up for you on your own account.",
    indexCta: "See the pack",
    mcpCount: (n: number) => `${n} MCP${n > 1 ? "s" : ""}`,
    noKey: "No API key to bring",
    toBring: (n: number) => `${n} setting${n > 1 ? "s" : ""} to provide`,
    fitsFree: "Fits on the free-credit server",
    requestSetup: "Request a guided setup",
    startFree: "Start free",
    problemEyebrow: "The problem",
    problemTitle: "Why this pack",
    forWhom: "Who it is for",
    packEyebrow: "The pack",
    packTitle: "What is in it",
    packHead: ["MCP", "What it does"],
    youBring: "You provide",
    nothing: "Nothing",
    catalogLink: "Details",
    bringEyebrow: "Before you start",
    bringTitle: "What you bring",
    bringNone:
      "Nothing beyond your TwinMCP account: every MCP in this pack installs without an API key or setting.",
    bringSome:
      "Settings are typed in when you install the MCP from your dashboard. Secret values are encrypted at rest with AES-256-GCM.",
    promptsEyebrow: "In practice",
    promptsTitle: "What you can ask your assistant",
    promptsLead:
      "Example requests the tools of this pack can carry out. Your AI client decides which tool to call.",
    uses: "Uses",
    needsFiles: "Needs a repository or files already in your box",
    pathsEyebrow: "Two ways to set it up",
    pathsTitle: "Do it yourself, or have it set up for you",
    diy: {
      name: "Do it yourself",
      steps: [
        `Create your TwinMCP account: ${SIGNUP_OFFER.en}.`,
        "Create a server, then install each MCP of the pack from the catalogue in your dashboard.",
        "Copy the configuration from the server's Connect panel into your AI client, with your API key.",
      ],
      pro: "See prices",
    },
    guided: {
      name: "Guided setup",
      body: "We create the server and install this pack on your account, configure the MCPs that need settings, and connect your AI client with you. Every action we take is written to your audit log.",
      cta: "Request a guided setup",
    },
    priceLine: "Pay as you go; guided setup quoted after a short call.",
    planFacts: () => `${WALLET_SUMMARY.en} ${FUNDED_UNLOCKS.en}`,
    faqEyebrow: "FAQ",
    faqTitle: "Questions about this pack",
    otherEyebrow: "Other packs",
    otherTitle: "Other teams, other stacks",
  },
  fr: {
    home: "Accueil",
    solutions: "Solutions",
    indexEyebrow: "Solutions",
    indexTitle: "Une stack MCP pour chaque équipe",
    indexLead:
      "Des packs de départ de serveurs MCP hébergés, chacun pensé pour un type d’équipe. Installez un pack vous-même avec votre crédit offert, ou laissez-nous l’installer pour vous, sur votre propre compte.",
    indexCta: "Voir le pack",
    mcpCount: (n: number) => `${n} MCP`,
    noKey: "Aucune clé API à fournir",
    toBring: (n: number) => `${n} paramètre${n > 1 ? "s" : ""} à fournir`,
    fitsFree: "Tient sur le serveur du crédit offert",
    requestSetup: "Demander une installation",
    startFree: "Démarrer gratuitement",
    problemEyebrow: "Le problème",
    problemTitle: "Pourquoi ce pack",
    forWhom: "Pour qui",
    packEyebrow: "Le pack",
    packTitle: "Ce qu’il contient",
    packHead: ["MCP", "Ce qu’il fait"],
    youBring: "À fournir",
    nothing: "Rien",
    catalogLink: "Détails",
    bringEyebrow: "Avant de commencer",
    bringTitle: "Ce que vous apportez",
    bringNone:
      "Rien d’autre que votre compte TwinMCP : chaque MCP de ce pack s’installe sans clé API ni paramètre.",
    bringSome:
      "Les paramètres se saisissent à l’installation du MCP, depuis votre tableau de bord. Les valeurs secrètes sont chiffrées au repos en AES-256-GCM.",
    promptsEyebrow: "En pratique",
    promptsTitle: "Ce que vous pouvez demander à votre assistant",
    promptsLead:
      "Des exemples de demandes que les outils de ce pack savent traiter. C’est votre client IA qui choisit l’outil à appeler.",
    uses: "Utilise",
    needsFiles: "Nécessite un dépôt ou des fichiers déjà présents dans votre box",
    pathsEyebrow: "Deux façons de l’installer",
    pathsTitle: "Vous-même, ou avec nous",
    diy: {
      name: "Vous-même",
      steps: [
        `Créez votre compte TwinMCP : ${SIGNUP_OFFER.fr}.`,
        "Créez un serveur, puis installez chaque MCP du pack depuis le catalogue de votre tableau de bord.",
        "Copiez la configuration du panneau Connect du serveur dans votre client IA, avec votre clé API.",
      ],
      pro: "Voir les tarifs",
    },
    guided: {
      name: "Installation accompagnée",
      body: "Nous créons le serveur et installons ce pack sur votre compte, configurons les MCP qui demandent des paramètres et connectons votre client IA avec vous. Chacune de nos actions est inscrite dans votre journal d’audit.",
      cta: "Demander une installation",
    },
    priceLine: "Paiement à l’usage ; installation accompagnée chiffrée après un court appel.",
    planFacts: () => `${WALLET_SUMMARY.fr} ${FUNDED_UNLOCKS.fr}`,
    faqEyebrow: "FAQ",
    faqTitle: "Questions sur ce pack",
    otherEyebrow: "Autres packs",
    otherTitle: "D’autres équipes, d’autres stacks",
  },
} as const;

/** One line of small-caps facts under a hero or a card ("3 MCPs · No API key…"). */
function packFacts(solution: Solution, locale: Locale): string[] {
  const t = UI[locale];
  const mcps = solutionMcps(solution);
  const needing = mcpsNeedingInput(solution);
  const facts: string[] = [t.mcpCount(mcps.length)];
  facts.push(needing.length === 0 ? t.noKey : t.toBring(needing.length));
  if (mcps.length <= FREE_MCP_LIMIT) facts.push(t.fitsFree);
  return facts;
}

function AddressLine({ items }: { items: string[] }) {
  return (
    <p className="smallcaps tracking-sc lining text-xs text-muted-foreground">
      {items.join(" · ")}
    </p>
  );
}

// ─── Index ───────────────────────────────────────────────────────────────────

export function SolutionsIndexView({ locale }: { locale: Locale }) {
  const t = UI[locale];
  const indexPath = SOLUTIONS_INDEX_PATHS[locale];
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: t.home, url: locale === "fr" ? "/fr" : "/" },
            { name: t.solutions, url: indexPath },
          ]),
          itemListSchema(
            SOLUTIONS.map((s) => ({ name: s[locale].title, url: solutionPath(s, locale) }))
          ),
        ]}
      />
      <section className="w-full py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className={EYEBROW_RULES}>{t.indexEyebrow}</p>
          <h1 className="display letterpress mx-auto mt-6 max-w-4xl text-balance text-4xl md:text-5xl lg:text-6xl">
            {t.indexTitle}
          </h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t.indexLead}
          </p>
        </div>
      </section>

      <Section bordered>
        <ul className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {SOLUTIONS.map((s) => {
            const c = s[locale];
            return (
              <li key={s.bundleId} className="flex flex-col border border-border bg-card p-6">
                <p className="eyebrow">{c.eyebrow}</p>
                <h2 className="mt-3 text-xl font-medium">
                  <Link href={solutionPath(s, locale) as Route} className="hover:underline">
                    {c.title}
                  </Link>
                </h2>
                <p className="mt-3 flex-1 text-base text-muted-foreground">{c.lead}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {solutionMcps(s).map((m) => (
                    <code
                      key={m.slug}
                      className="border border-border bg-background px-2 py-0.5 font-mono text-sm text-muted-foreground"
                    >
                      {m.slug}
                    </code>
                  ))}
                </div>
                <div className="mt-4">
                  <AddressLine items={packFacts(s, locale)} />
                </div>
                <Link
                  href={solutionPath(s, locale) as Route}
                  className={`smallcaps tracking-sc mt-5 inline-flex min-h-10 items-center gap-2 text-sm ${LINK}`}
                  data-cta-location={`solutions_index_${s.bundleId}`}
                >
                  {t.indexCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="lining mx-auto mt-12 max-w-3xl text-center text-sm italic text-muted-foreground">
          {t.priceLine} {t.planFacts()}
        </p>
      </Section>
    </>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export function SolutionView({ solution, locale }: { solution: Solution; locale: Locale }) {
  const t = UI[locale];
  const c = solution[locale];
  const mcps = solutionMcps(solution);
  const needing = mcpsNeedingInput(solution);
  const path = solutionPath(solution, locale);
  const demoHref = guidedSetupHref(solution, locale);
  const others = SOLUTIONS.filter((s) => s.bundleId !== solution.bundleId);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: t.home, url: locale === "fr" ? "/fr" : "/" },
            { name: t.solutions, url: SOLUTIONS_INDEX_PATHS[locale] },
            { name: c.name, url: path },
          ]),
          faqPageSchema([...c.faq]),
        ]}
      />

      {/* The centred name: eyebrow, engraved H1, hairline, lead, CTAs, address line. */}
      <section className="w-full py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className={EYEBROW_RULES}>{c.eyebrow}</p>
          <h1 className="display letterpress mx-auto mt-6 max-w-4xl text-balance text-4xl md:text-5xl lg:text-6xl">
            {c.title}
          </h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {c.lead}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full max-w-xs sm:w-auto sm:max-w-none">
              <Link
                href={signUpHref(locale, "free") as Route}
                data-cta-location={`solution_hero_${solution.bundleId}`}
              >
                {t.startFree}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link
                href={demoHref as Route}
                data-cta-location={`solution_hero_guided_${solution.bundleId}`}
              >
                {t.requestSetup}
              </Link>
            </Button>
          </div>
          <div className="mt-8">
            <AddressLine items={packFacts(solution, locale)} />
          </div>
        </div>
      </section>

      <Section bordered eyebrow={t.problemEyebrow} title={t.problemTitle}>
        <div className="mx-auto max-w-3xl">
          {c.problem.map((p) => (
            <p key={p} className="mt-4 text-lg text-muted-foreground first:mt-0">
              {p}
            </p>
          ))}
          <div className="mt-10 border-l border-foreground/60 pl-5">
            <h3 className="smallcaps tracking-sc text-base font-medium">{t.forWhom}</h3>
            <p className="mt-2 text-base text-muted-foreground">{c.audience}</p>
          </div>
        </div>
      </Section>

      <Section bordered eyebrow={t.packEyebrow} title={t.packTitle}>
        <div className="mx-auto max-w-4xl">
          <div
            aria-hidden
            className="smallcaps tracking-sc hidden border-b border-foreground/50 pb-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-8"
          >
            <span>{t.packHead[0]}</span>
            <span>{t.packHead[1]}</span>
          </div>
          <ul className="border-t border-foreground/50 sm:border-t-0">
            {mcps.map((m) => {
              // Link to the catalogue page when one exists (EN content only).
              const detail = locale === "en" && getServerBySlug(m.slug);
              return (
                <li
                  key={m.slug}
                  className="grid gap-2 border-b border-border py-5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-8"
                >
                  <div>
                    <strong className="text-base font-medium">{m.name}</strong>
                    <code className="mt-1 block font-mono text-sm text-muted-foreground">
                      {m.slug}
                    </code>
                  </div>
                  <div>
                    <p className="text-base text-muted-foreground">{m.description[locale]}</p>
                    <p className="mt-2 text-sm">
                      <span className="smallcaps tracking-sc text-xs text-muted-foreground">
                        {t.youBring} ·{" "}
                      </span>
                      <span className={m.needs ? "text-foreground" : "text-muted-foreground"}>
                        {m.needs ? m.needs[locale] : t.nothing}
                      </span>
                      {detail && (
                        <>
                          {" "}
                          <span className="text-muted-foreground">·</span>{" "}
                          <Link href={`/servers/${m.slug}` as Route} className={LINK}>
                            {t.catalogLink}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section bordered eyebrow={t.bringEyebrow} title={t.bringTitle}>
        <div className="mx-auto max-w-3xl">
          {needing.length === 0 ? (
            <p className="text-lg text-muted-foreground">{t.bringNone}</p>
          ) : (
            <>
              <ul className="divide-y divide-border border-y border-border">
                {needing.map((m) => (
                  <li key={m.slug} className="py-4">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground"> · {m.needs?.[locale]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-base text-muted-foreground">{t.bringSome}</p>
            </>
          )}
          {c.notes.length > 0 && (
            <ul className="mt-8 space-y-3">
              {c.notes.map((n) => (
                <li
                  key={n}
                  className="border border-info/40 bg-info/10 px-4 py-3 text-sm text-info"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section
        bordered
        eyebrow={t.promptsEyebrow}
        title={t.promptsTitle}
        description={t.promptsLead}
      >
        <ul className="mx-auto grid max-w-4xl gap-4">
          {c.prompts.map((p) => (
            <li key={p.text} className="border border-border bg-secondary/60 p-5">
              <p className="font-mono text-sm leading-relaxed text-foreground">{p.text}</p>
              <p className="smallcaps tracking-sc mt-3 text-xs text-muted-foreground">
                {t.uses} · {p.uses.join(", ")}
                {p.needsFiles ? ` · ${t.needsFiles}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section bordered eyebrow={t.pathsEyebrow} title={t.pathsTitle}>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className="flex flex-col border border-border bg-card p-6">
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.diy.name}</h3>
            <ol className="mt-4 flex-1 space-y-3">
              {t.diy.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-base text-muted-foreground">
                  <span aria-hidden className="lining font-medium text-foreground">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link
                  href={signUpHref(locale, "free") as Route}
                  data-cta-location={`solution_diy_free_${solution.bundleId}`}
                >
                  {t.startFree}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={PRICING_HREF[locale] as Route}
                  data-cta-location={`solution_diy_pricing_${solution.bundleId}`}
                >
                  {t.diy.pro}
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-col border border-foreground/60 bg-card p-6">
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.guided.name}</h3>
            <p className="mt-4 flex-1 text-base text-muted-foreground">{t.guided.body}</p>
            <div className="mt-6">
              <Button asChild>
                <Link
                  href={demoHref as Route}
                  data-cta-location={`solution_guided_${solution.bundleId}`}
                >
                  {t.guided.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-lg font-medium">{t.priceLine}</p>
          <p className="lining mt-3 text-sm italic text-muted-foreground">{t.planFacts()}</p>
        </div>
      </Section>

      <div className="rule-double">
        <Faq
          locale={locale}
          items={[...c.faq]}
          eyebrow={t.faqEyebrow}
          title={t.faqTitle}
          id="solution-faq"
          description=""
          variant="list"
        />
      </div>

      <Section bordered eyebrow={t.otherEyebrow} title={t.otherTitle}>
        <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {others.map((s) => (
            <li key={s.bundleId}>
              <Link
                href={solutionPath(s, locale) as Route}
                className="flex min-h-10 items-center justify-between gap-4 border border-border bg-card p-4 transition-colors hover:bg-secondary"
              >
                <span>
                  <span className="eyebrow block">{s[locale].eyebrow}</span>
                  <span className="mt-1 block text-base font-medium">{s[locale].name}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
