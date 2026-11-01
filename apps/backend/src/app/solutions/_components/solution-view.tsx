import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Faq } from "@/components/marketing/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import {
  FUNDED_UNLOCKS,
  SIGNUP_OFFER,
  WALLET_SUMMARY,
  walletFacts,
} from "@/components/pricing/wallet-copy";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
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

const EN = walletFacts("en");
const FR = walletFacts("fr");

const LINK = "font-medium text-brand underline-offset-4 hover:underline";

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
    startFree: `Claim my ${EN.signupCredit} credit`,
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
    startFree: `Récupérer mes ${FR.signupCredit} offerts`,
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

/** One line of facts under a hero or a card ("3 MCPs · No API key…"). */
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
    <p className="text-xs tabular-nums text-muted-foreground sm:text-sm">{items.join(" · ")}</p>
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
      <section className="w-full py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="eyebrow">{t.indexEyebrow}</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t.indexTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t.indexLead}
          </p>
        </div>
      </section>

      <Section bordered>
        <ul className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 md:gap-6">
          {SOLUTIONS.map((s) => {
            const c = s[locale];
            return (
              <li
                key={s.bundleId}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md sm:p-6"
              >
                <p className="eyebrow">{c.eyebrow}</p>
                <h2 className="mt-3 font-display text-xl font-bold tracking-tight">
                  <Link href={solutionPath(s, locale) as Route} className="hover:text-brand">
                    {c.title}
                  </Link>
                </h2>
                <p className="mt-3 flex-1 text-base text-muted-foreground">{c.lead}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {solutionMcps(s).map((m) => (
                    <code
                      key={m.slug}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-sm text-muted-foreground"
                    >
                      {hasBrandLogo(m.slug) ? (
                        <BrandLogo slug={m.slug} size={14} decorative />
                      ) : null}
                      {m.slug}
                    </code>
                  ))}
                </div>
                <div className="mt-4">
                  <AddressLine items={packFacts(s, locale)} />
                </div>
                <Link
                  href={solutionPath(s, locale) as Route}
                  className={`mt-5 inline-flex min-h-10 items-center gap-2 text-sm ${LINK}`}
                  data-cta-location={`solutions_index_${s.bundleId}`}
                >
                  {t.indexCta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mx-auto mt-12 max-w-3xl text-center text-sm tabular-nums text-muted-foreground">
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

      {/* Hero: eyebrow, H1, lead, one rose CTA, the guided path, the pack facts. */}
      <section className="w-full py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {c.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {c.lead}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link
                href={signUpHref(locale, "free") as Route}
                data-cta-location={`solution_hero_${solution.bundleId}`}
              >
                {t.startFree}
                <ArrowRight aria-hidden />
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
          <div className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="font-display text-base font-semibold tracking-tight">{t.forWhom}</h3>
            <p className="mt-2 text-base text-muted-foreground">{c.audience}</p>
          </div>
        </div>
      </Section>

      <Section bordered eyebrow={t.packEyebrow} title={t.packTitle}>
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div
            aria-hidden
            className="hidden border-b border-border bg-surface-alt px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-8"
          >
            <span>{t.packHead[0]}</span>
            <span>{t.packHead[1]}</span>
          </div>
          <ul className="divide-y divide-border">
            {mcps.map((m) => {
              // Link to the catalogue page when one exists (EN content only).
              const detail = locale === "en" && getServerBySlug(m.slug);
              return (
                <li
                  key={m.slug}
                  className="grid gap-2 px-5 py-5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-8"
                >
                  <div>
                    <span className="flex items-center gap-2">
                      {hasBrandLogo(m.slug) ? (
                        <BrandLogo slug={m.slug} size={18} decorative />
                      ) : null}
                      <strong className="text-base font-semibold">{m.name}</strong>
                    </span>
                    <code className="mt-1 block font-mono text-sm text-muted-foreground">
                      {m.slug}
                    </code>
                  </div>
                  <div>
                    <p className="text-base text-muted-foreground">{m.description[locale]}</p>
                    <p className="mt-2 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground">
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
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                {needing.map((m) => (
                  <li key={m.slug} className="px-5 py-4">
                    <span className="font-semibold">{m.name}</span>
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
                  className="flex gap-3 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{n}</span>
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
            <li key={p.text} className="rounded-2xl border border-border bg-surface-alt p-5">
              <p className="font-mono text-sm leading-relaxed text-foreground">{p.text}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t.uses} · {p.uses.join(", ")}
                {p.needsFiles ? ` · ${t.needsFiles}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section bordered eyebrow={t.pathsEyebrow} title={t.pathsTitle}>
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 md:gap-6">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="font-display text-lg font-semibold tracking-tight">{t.diy.name}</h3>
            <ol className="mt-4 flex-1 space-y-3">
              {t.diy.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-base text-muted-foreground">
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold tabular-nums text-brand-foreground"
                  >
                    {i + 1}
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
          <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="font-display text-lg font-semibold tracking-tight">{t.guided.name}</h3>
            <p className="mt-4 flex-1 text-base text-muted-foreground">{t.guided.body}</p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link
                  href={demoHref as Route}
                  data-cta-location={`solution_guided_${solution.bundleId}`}
                >
                  {t.guided.cta}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-lg font-semibold">{t.priceLine}</p>
          <p className="mt-3 text-sm tabular-nums text-muted-foreground">{t.planFacts()}</p>
        </div>
      </Section>

      <div className="border-t border-border">
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
                className="group flex min-h-10 items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md"
              >
                <span>
                  <span className="eyebrow block">{s[locale].eyebrow}</span>
                  <span className="mt-1 block font-display text-base font-semibold tracking-tight group-hover:text-brand">
                    {s[locale].name}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
