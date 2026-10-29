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
import { Separator } from "@/components/ui/separator";
import { COPY } from "./copy";
import { Breadcrumbs, HostCta, SectionTitle } from "./parts";

const INDEX_LINK =
  "text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline";

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

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <Breadcrumbs crumbs={crumbs} />

        <header className="pb-10">
          <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
            {t.setupGuide}
          </p>
          <h1 className="mt-5 text-4xl font-medium sm:text-5xl">{data.h1}</h1>
          <div className="mt-6 h-px w-12 bg-foreground/40" />
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">{server.description}</p>
        </header>
        <Separator variant="double" />

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
        <section className="mt-14 border-t border-border pt-10">
          <SectionTitle>{t.aboutClientTitle(label, server.name)}</SectionTitle>
          <ul className="space-y-3 text-base leading-7">
            {data.notes.map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <span className="min-w-0 break-words text-foreground/90">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionTitle>{t.clientStepsTitle}</SectionTitle>
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

        <section className="mt-14 border-t border-border pt-10" id="troubleshooting">
          <SectionTitle>{t.troubleshootingTitle}</SectionTitle>
          <dl className="divide-y divide-border border-y border-border">
            {data.troubleshooting.map((item) => (
              <div key={item.title} className="py-5">
                <dt className="text-lg font-medium">
                  <Link
                    href={item.href as Route}
                    className="underline-offset-4 transition-colors hover:text-brand hover:underline"
                  >
                    {item.title}
                  </Link>
                </dt>
                <dd className="mt-2 break-words text-base text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm">
            <Link
              href={`${server.docsHref}#troubleshooting` as Route}
              className="text-foreground underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
            >
              {t.troubleshootingMore}
            </Link>
          </p>
        </section>

        <section className="rule-double mt-14 pt-10">
          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            <div>
              <h2 className="eyebrow mb-4 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                {t.otherClients(server.name)}
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href={serverPath(server.slug, locale) as Route}
                    className="text-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
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
                <h2 className="eyebrow mb-4 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
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
    </>
  );
}
