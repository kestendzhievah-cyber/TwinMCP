import type { Route } from "next";
import Link from "next/link";
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
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COPY } from "./copy";
import { Breadcrumbs, HostCta, SectionTitle, SnippetTabs } from "./parts";

const LINK =
  "text-foreground underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

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

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20" lang={locale}>
        <Breadcrumbs crumbs={crumbs} />

        <header className="pb-10 text-center">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            {data.categoryLabel}
          </p>
          <h1 className="display letterpress mt-6 text-4xl sm:text-5xl md:text-6xl">{data.h1}</h1>
          <div className="mx-auto mt-7 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {data.description}
          </p>
          <p className="smallcaps tracking-sc lining mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {data.facts.map((f, i) => (
              <span key={f} className="flex items-center gap-x-3">
                {i > 0 && <span aria-hidden>·</span>}
                <span>{f}</span>
              </span>
            ))}
          </p>
        </header>
        <Separator variant="double" />

        {data.hostMode === "local" && (
          <aside className="mt-10 border border-info/40 border-l-2 border-l-info bg-info/10 p-4 text-sm text-info">
            <strong className="smallcaps tracking-sc font-medium">{t.localTitle}</strong>
            <p className="mt-2 text-foreground/90">{t.localText(data.name)}</p>
          </aside>
        )}

        {/* What it does: the seed description, then the exact package and command. */}
        <section className="mt-10">
          <SectionTitle>{t.whatItDoes}</SectionTitle>
          <p className="text-lg leading-8 text-foreground/90">{data.description}</p>
          <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
            {data.launch.packageName && (
              <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
                <dt className="smallcaps tracking-sc text-muted-foreground">{t.packageLabel}</dt>
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
              <dt className="smallcaps tracking-sc text-muted-foreground">{t.commandLabel}</dt>
              <dd className="min-w-0">
                <code className="break-all font-mono text-foreground">{data.launch.command}</code>
              </dd>
            </div>
          </dl>
        </section>

        {/* Keys and settings: the real config schema, with where to get each value. */}
        <section className="mt-14 border-t border-border pt-10">
          <SectionTitle>{t.keysTitle}</SectionTitle>
          {data.fields.length === 0 ? (
            <p className="text-base text-muted-foreground">{t.noKeysText}</p>
          ) : (
            <>
              <p className="mb-6 text-base text-muted-foreground">{t.keysLead}</p>
              <Table className="border-b border-border">
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
        <section className="mt-14 border-t border-border pt-10">
          <SectionTitle>{t.stepsTitle}</SectionTitle>
          <ol className="space-y-5">
            {data.steps.map((s, i) => (
              <li key={s.name} className="flex gap-4">
                <span
                  aria-hidden
                  className="lining mt-0.5 grid h-8 w-8 shrink-0 place-items-center border border-border bg-card text-xs font-medium"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="smallcaps tracking-sc block text-sm font-medium text-foreground">
                    {s.name}
                  </span>
                  <span className="mt-1 block break-words text-base leading-7 text-foreground/90">
                    {s.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Connect snippets for every client, from the Connect panel's generator. */}
        <section className="mt-14 border-t border-border pt-10">
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
          <section className="mt-14 border-t border-border pt-10">
            <SectionTitle>{t.clientsTitle(data.name)}</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {snippets.map((s) => (
                <li key={s.client}>
                  <Link
                    href={clientPath(data.slug, s.client, locale) as Route}
                    className="smallcaps tracking-sc flex items-center justify-between gap-4 border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/60"
                  >
                    <span>{s.label}</span>
                    <span aria-hidden className="text-muted-foreground">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14 border-t border-border pt-10">
          <SectionTitle>{t.faqTitle}</SectionTitle>
          <dl className="divide-y divide-border border-y border-border">
            {data.faq.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="text-lg font-medium">{item.q}</dt>
                <dd className="mt-2 break-words text-base text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="rule-double mt-14 pt-12">
          <HostCta
            name={data.name}
            locale={locale}
            signUpHref={data.signUpHref}
            pricingHref={data.pricingHref}
          />

          {posts.length > 0 && (
            <div className="mt-14">
              <h2 className="eyebrow mb-6 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                {t.readingTitle}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {posts.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}` as Route}
                      className="group flex h-full flex-col border border-border bg-card p-5 transition-colors hover:border-foreground/60"
                    >
                      <h3 className="text-lg font-medium leading-snug group-hover:underline group-hover:decoration-brand group-hover:underline-offset-4">
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
              <h2 className="eyebrow mb-6 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                {t.relatedTitle}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={serverPath(r.slug, locale) as Route}
                      className="group flex h-full flex-col border border-border bg-card p-5 transition-colors hover:border-foreground/60"
                    >
                      <h3 className="smallcaps tracking-sc text-lg font-medium leading-snug group-hover:underline group-hover:decoration-brand group-hover:underline-offset-[6px]">
                        {r.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
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
    </>
  );
}
