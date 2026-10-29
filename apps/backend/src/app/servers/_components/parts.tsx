import type { Route } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import type { ClientSnippetView } from "@/lib/seo/server-pages";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { COPY } from "./copy";

export interface Crumb {
  name: string;
  href: string;
}

/** Small-caps breadcrumb line; the last crumb is the current page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="smallcaps tracking-sc mb-12 text-xs text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-x-3">
              {i > 0 && <span aria-hidden>·</span>}
              {last ? (
                <span aria-current="page" className="line-clamp-1 text-foreground">
                  {c.name}
                </span>
              ) : (
                <Link href={c.href as Route} className="transition-colors hover:text-foreground">
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** One tab per MCP client, each a copyable snippet plus a link to its guide. */
export function SnippetTabs({
  snippets,
  locale,
  guideHref,
}: {
  snippets: ClientSnippetView[];
  locale: Locale;
  /** Link to the per-client guide, or null when it does not exist in this locale. */
  guideHref: (client: ClientSnippetView["client"]) => string | null;
}) {
  const t = COPY[locale];
  return (
    <Tabs defaultValue={snippets[0]?.client} className="min-w-0">
      <TabsList aria-label={t.tabsLabel}>
        {snippets.map((s) => (
          <TabsTrigger key={s.client} value={s.client}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {snippets.map((s) => {
        const href = guideHref(s.client);
        return (
          <TabsContent key={s.client} value={s.client} className="min-w-0">
            <CodeSnippet
              code={s.code}
              language={s.language}
              filename={s.filename}
              locale={locale}
            />
            {href && (
              <p className="mt-3 text-sm">
                <Link
                  href={href as Route}
                  className="text-foreground underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
                >
                  {t.clientGuide(s.label)}
                </Link>
              </p>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

/** The closing call to action: the card with one primary and one secondary button. */
export function HostCta({
  name,
  title,
  locale,
  signUpHref,
  pricingHref,
}: {
  name: string;
  /** Overrides the default "Host <name> on TwinMCP". */
  title?: string;
  locale: Locale;
  signUpHref: string;
  pricingHref: string;
}) {
  const t = COPY[locale];
  return (
    <div className="border border-foreground/70 bg-card px-6 py-10 text-center md:px-10">
      <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
        {t.ctaEyebrow}
      </p>
      <h2 className="mt-6 text-2xl font-medium md:text-3xl">{title ?? t.ctaTitle(name)}</h2>
      <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">{t.ctaText}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href={signUpHref as Route}>{t.ctaPrimary}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={pricingHref as Route}>{t.ctaSecondary}</Link>
        </Button>
      </div>
    </div>
  );
}

/** Section heading on a hairline, as on the other content pages. */
export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-6 text-2xl font-medium md:text-3xl">
      {children}
    </h2>
  );
}
