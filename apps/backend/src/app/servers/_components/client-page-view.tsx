import type { Route } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import { MATRIX_CLIENTS, IDE_LABELS } from "@/lib/mcp/client-config";
import type { ServerEntry } from "@/lib/servers/catalog";
import {
  clientPath,
  hasFrClientGuides,
  serverPath,
  serversIndexPath,
  type ClientPageData,
} from "@/lib/seo/server-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, howToSchema } from "@/lib/seo/schema";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { COPY } from "./copy";
import { Breadcrumbs, HostCta, SectionTitle, ServerMark } from "./parts";

const INDEX_LINK =
  "text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline";

// Links in running text: brand blue, underlined at rest.
const LINK =
  "font-medium text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

const SECTION = "mt-14 border-t border-border pt-10";

export function ClientPageView({
  data,
  related,
}: {
  data: ClientPageData;
  /** Same-category MCPs; only those with a guide in this locale are linked. */
  related: ServerEntry[];
}) {
  const locale: Locale = data.locale;
  const t = COPY[locale];
  const server = data.server;
  const label = data.clientLabel;
  const linkable = related.filter((r) => locale === "en" || hasFrClientGuides(r.slug));

  const crumbs = [
    { name: t.home, href: t.homeHref },
    { name: t.catalogue, href: serversIndexPath(locale) },
    { name: server.name, href: server.path },
    { name: label, href: data.path },
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
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-14">
        <Breadcrumbs crumbs={crumbs} />

        <header className="border-b border-border pb-10">
          <div aria-hidden className="mb-5 flex items-center gap-2">
            <ServerMark slug={server.slug} category={server.categoryKey} />
            {hasBrandLogo(data.client) && (
              <>
                <span className="text-muted-foreground">+</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground">
                  <BrandLogo slug={data.client} size={24} decorative />
                </span>
              </>
            )}
          </div>
          <p className="eyebrow">{t.setupGuide}</p>
          <h1 className="mt-3 text-balance font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            {data.h1}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground md:text-xl">{server.description}</p>
        </header>

        {/* The snippet for this client, from the Connect panel's generator. */}
        <section className="mt-10">
          <SectionTitle>
            {data.snippet.command ? t.commandTitle(label) : t.configTitle(label)}
          </SectionTitle>
          <CodeSnippet
            code={data.snippet.code}
            language={data.snippet.language}
            filename={data.snippet.filename}
            locale={locale}
          />
          <p className="mt-4 break-words text-sm text-muted-foreground">
            {t.connectLead(server.mcpUrl)}
          </p>
        </section>

        {/* What is specific to this client, then to this MCP's config and host mode. */}
        <section className={SECTION}>
          <SectionTitle>{t.aboutClientTitle(label, server.name)}</SectionTitle>
          <ul className="space-y-3 text-base leading-7">
            {data.notes.map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden className="font-semibold text-brand">
                  →
                </span>
                <span className="min-w-0 break-words text-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={SECTION}>
          <SectionTitle>{t.clientStepsTitle}</SectionTitle>
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

        <section className={`${SECTION} scroll-mt-24`} id="troubleshooting">
          <SectionTitle>{t.troubleshootingTitle}</SectionTitle>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:px-6">
            {data.troubleshooting.map((item) => (
              <div key={item.title} className="py-5">
                <dt className="text-base font-semibold">
                  <Link
                    href={item.href as Route}
                    className="text-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                  >
                    {item.title}
                  </Link>
                </dt>
                <dd className="mt-2 break-words text-base text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm">
            <Link href={`${server.docsHref}#troubleshooting` as Route} className={LINK}>
              {t.troubleshootingMore}
            </Link>
          </p>
        </section>

        <section className={SECTION}>
          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            <div>
              <h2 className="mb-4 font-display text-lg font-bold tracking-tight">
                {t.otherClients(server.name)}
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href={serverPath(server.slug, locale) as Route}
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {t.fullGuide(server.name)}
                  </Link>
                </li>
                {MATRIX_CLIENTS.filter((c) => c !== data.client).map((c) => (
                  <li key={c}>
                    <Link href={clientPath(server.slug, c, locale) as Route} className={INDEX_LINK}>
                      {IDE_LABELS[c]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {linkable.length > 0 && (
              <div>
                <h2 className="mb-4 font-display text-lg font-bold tracking-tight">
                  {t.sameClient(label)}
                </h2>
                <ul className="space-y-2 text-sm">
                  {linkable.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={clientPath(r.slug, data.client, locale) as Route}
                        className={INDEX_LINK}
                      >
                        {r.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-14">
          <HostCta
            name={server.name}
            locale={locale}
            signUpHref={server.signUpHref}
            pricingHref={server.pricingHref}
          />
        </footer>
      </article>
      <StickyMobileCta locale={locale} />
    </>
  );
}
