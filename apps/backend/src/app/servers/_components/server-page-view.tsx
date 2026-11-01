import type { Route } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { localizedDescription, type ServerEntry } from "@/lib/servers/catalog";
import {
  clientPath,
  clientSnippets,
  hasFrClientGuides,
  serverPath,
  serversIndexPath,
  type ServerPageData,
} from "@/lib/seo/server-pages";
import { getPostsBySlugs } from "@/lib/blog/posts";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { COPY } from "./copy";
import { Breadcrumbs, HostCta, SectionTitle, ServerMark, SnippetTabs } from "./parts";

// Links in running text: brand blue, underlined at rest.
const LINK =
  "font-medium text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

// A related card (blog post or MCP): the interactive card recipe.
const RELATED_CARD =
  "group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SECTION = "mt-14 border-t border-border pt-10";

export function ServerPageView({
  data,
  related,
}: {
  data: ServerPageData;
  related: ServerEntry[];
}) {
  const locale: Locale = data.locale;
  const t = COPY[locale];
  const snippets = clientSnippets(data.slug, locale);
  const guides = locale === "en" || hasFrClientGuides(data.slug);
  const posts = locale === "en" ? getPostsBySlugs(data.relatedBlogSlugs) : [];
  const locked = PROMO_EXCLUDED_MCP_SLUGS.includes(data.slug);

  const crumbs = [
    { name: t.home, href: t.homeHref },
    { name: t.catalogue, href: serversIndexPath(locale) },
    { name: data.name, href: data.path },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema(crumbs.map((c) => ({ name: c.name, url: c.href }))),
          howToSchema({
            name: data.h1,
            description: data.metaDescription,
            steps: data.steps.map((s) => ({ name: s.name, text: s.text })),
          }),
          faqPageSchema(data.faq),
        ]}
      />

      <article
        className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-14"
        lang={locale}
      >
        <Breadcrumbs crumbs={crumbs} />

        <header className="border-b border-border pb-10 text-center">
          <ServerMark
            slug={data.slug}
            category={data.categoryKey}
            size="lg"
            className="mx-auto mb-5"
          />
          <p className="eyebrow">{data.categoryLabel}</p>
          <h1 className="mt-3 text-balance font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            {data.h1}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            {data.description}
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {data.facts.map((f) => (
              <li
                key={f}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground"
              >
                {f}
              </li>
            ))}
            {locked && (
              <li>
                <Badge variant="offer" className="px-3 py-1">
                  <Lock className="h-3 w-3" aria-hidden />
                  {t.unlocks}
                </Badge>
              </li>
            )}
          </ul>
        </header>

        {locked && (
          <aside className="mt-10 flex gap-3 rounded-xl border border-offer-border bg-offer p-4 text-sm text-offer-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{t.unlocksText}</p>
          </aside>
        )}

        {data.hostMode === "local" && (
          <aside className="mt-10 rounded-xl border border-info/30 bg-info/10 p-4 text-sm">
            <strong className="font-semibold text-info">{t.localTitle}</strong>
            <p className="mt-1.5 text-foreground">{t.localText(data.name)}</p>
          </aside>
        )}

        {/* What it does: the seed description, then the exact package and command. */}
        <section className="mt-10">
          <SectionTitle>{t.whatItDoes}</SectionTitle>
          <p className="text-lg leading-8 text-foreground">{data.description}</p>
          <dl className="mt-6 divide-y divide-border rounded-xl border border-border bg-card px-4 text-sm">
            {data.launch.packageName && (
              <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
                <dt className="font-medium text-muted-foreground">{t.packageLabel}</dt>
                <dd className="min-w-0">
                  <code className="break-all font-mono text-foreground">
                    {data.launch.packageName}
                    {data.launch.pinnedVersion ? `@${data.launch.pinnedVersion}` : ""}
                  </code>
                  {data.repoUrl && (
                    <>
                      {" — "}
                      <a
                        href={data.repoUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                        className={LINK}
                      >
                        {t.upstream}
                      </a>
                    </>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    {data.launch.pinnedVersion
                      ? t.pinnedNote(data.launch.pinnedVersion)
                      : t.latestNote}
                  </p>
                </dd>
              </div>
            )}
            <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium text-muted-foreground">{t.commandLabel}</dt>
              <dd className="min-w-0">
                <code className="break-all font-mono text-foreground">{data.launch.command}</code>
              </dd>
            </div>
          </dl>
        </section>

        {/* Keys and settings: the real config schema, with where to get each value. */}
        <section className={SECTION}>
          <SectionTitle>{t.keysTitle}</SectionTitle>
          {data.fields.length === 0 ? (
            <p className="text-base text-muted-foreground">{t.noKeysText}</p>
          ) : (
            <>
              <p className="mb-6 text-base text-muted-foreground">{t.keysLead}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36%]">{t.colField}</TableHead>
                    <TableHead>{t.colWhere}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fields.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell className="align-top">
                        <code className="break-all font-mono text-sm text-foreground">{f.key}</code>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant={f.required ? "outline" : "secondary"}>
                            {f.required ? t.required : t.optional}
                          </Badge>
                          {f.secret && <Badge variant="secondary">{t.secret}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground">
                        {f.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </section>

        {/* Three steps on TwinMCP (also the HowTo structured data). */}
        <section className={SECTION}>
          <SectionTitle>{t.stepsTitle}</SectionTitle>
          <ol className="space-y-5">
            {data.steps.map((s, i) => (
              <li key={s.name} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold tabular-nums text-brand-foreground"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">{s.name}</span>
                  <span className="mt-1 block break-words text-base leading-7 text-muted-foreground">
                    {s.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Connect snippets for every client, from the Connect panel's generator. */}
        <section className={SECTION}>
          <SectionTitle>{t.connectTitle}</SectionTitle>
          <p className="mb-6 break-words text-base text-muted-foreground">
            {t.connectLead(data.mcpUrl)}
          </p>
          <SnippetTabs
            snippets={snippets}
            locale={locale}
            guideHref={(c) => (guides ? clientPath(data.slug, c, locale) : null)}
          />
          <p className="mt-6 break-words text-sm text-muted-foreground">
            {t.serverUrlNote(data.serverUrl)}
          </p>
        </section>

        {guides && (
          <section className={SECTION}>
            <SectionTitle>{t.clientsTitle(data.name)}</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {snippets.map((s) => (
                <li key={s.client} className="min-w-0">
                  <Link
                    href={clientPath(data.slug, s.client, locale) as Route}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm transition hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {hasBrandLogo(s.client) ? (
                        <BrandLogo slug={s.client} size={18} decorative />
                      ) : (
                        <span aria-hidden className="h-[18px] w-[18px] shrink-0" />
                      )}
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span aria-hidden className="text-muted-foreground group-hover:text-brand">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={SECTION}>
          <SectionTitle>{t.faqTitle}</SectionTitle>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-6">
            {data.faq.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="text-base font-semibold text-foreground">{item.q}</dt>
                <dd className="mt-2 break-words text-base text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-14 border-t border-border pt-12">
          <HostCta
            name={data.name}
            locale={locale}
            signUpHref={data.signUpHref}
            pricingHref={data.pricingHref}
          />

          {posts.length > 0 && (
            <div className="mt-14">
              <h2 className="mb-5 font-display text-xl font-bold tracking-tight">
                {t.readingTitle}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {posts.map((p) => (
                  <li key={p.slug} className="min-w-0">
                    <Link href={`/blog/${p.slug}` as Route} className={RELATED_CARD}>
                      <h3 className="font-display text-lg font-semibold leading-snug tracking-tight group-hover:text-brand">
                        {p.title}
                      </h3>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {related.length > 0 && (
            <div className="mt-14">
              <h2 className="mb-5 font-display text-xl font-bold tracking-tight">
                {t.relatedTitle}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug} className="min-w-0">
                    <Link href={serverPath(r.slug, locale) as Route} className={RELATED_CARD}>
                      <div className="flex min-w-0 items-center gap-3">
                        <ServerMark slug={r.slug} category={r.categoryKey} />
                        <h3 className="min-w-0 truncate font-display text-lg font-semibold leading-snug tracking-tight group-hover:text-brand">
                          {r.name}
                        </h3>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {localizedDescription(r, locale)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </footer>
      </article>
      <StickyMobileCta locale={locale} />
    </>
  );
}
