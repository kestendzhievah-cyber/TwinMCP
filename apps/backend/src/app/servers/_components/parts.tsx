import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Code2,
  Database,
  Globe,
  ListChecks,
  Palette,
  Puzzle,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import type { CategoryKey } from "@/lib/servers/catalog";
import type { ClientSnippetView } from "@/lib/seo/server-pages";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { OfferBadge } from "@/components/marketing/offer-badge";
import { TrustSignals } from "@/components/pricing/trust-signals";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COPY } from "./copy";

export interface Crumb {
  name: string;
  href: string;
}

/** Breadcrumb line; the last crumb is the current page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex min-w-0 items-center gap-x-1.5">
              {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />}
              {last ? (
                <span aria-current="page" className="line-clamp-1 font-medium text-foreground">
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

/** The lucide fallback of a catalogue MCP without a brand mark, by category. */
const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  web: Globe,
  data: Database,
  dev: Code2,
  productivity: ListChecks,
  ai: Sparkles,
  creative: Palette,
  utility: Wrench,
  docs: BookOpen,
  other: Puzzle,
};

/**
 * A catalogue MCP's mark on a white tile: its brand logo when it has one
 * (components/brand), otherwise its category's lucide icon in brand blue.
 * Logos are never tinted and always sit on the card colour.
 */
export function ServerMark({
  slug,
  category,
  size = "md",
  className,
}: {
  slug: string;
  category: CategoryKey;
  size?: "md" | "lg";
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Puzzle;
  const lg = size === "lg";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center border border-border bg-card text-foreground",
        lg ? "h-16 w-16 rounded-2xl shadow-sm" : "h-11 w-11 rounded-xl",
        className
      )}
    >
      {hasBrandLogo(slug) ? (
        <BrandLogo slug={slug} size={lg ? 36 : 24} decorative />
      ) : (
        <Icon className={cn("text-brand", lg ? "h-7 w-7" : "h-5 w-5")} />
      )}
    </span>
  );
}

/** One tab per MCP client (its mark + name), each a copyable snippet plus a link to its guide. */
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
      <TabsList
        aria-label={t.tabsLabel}
        className="h-auto max-w-full flex-wrap justify-start gap-1"
      >
        {snippets.map((s) => (
          <TabsTrigger key={s.client} value={s.client} className="gap-2">
            {hasBrandLogo(s.client) && <BrandLogo slug={s.client} size={16} decorative />}
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {snippets.map((s) => {
        const href = guideHref(s.client);
        return (
          <TabsContent key={s.client} value={s.client} className="mt-4 min-w-0">
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
                  className="font-medium text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
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

/**
 * The closing call to action: a strong-band panel with the offer pill, one
 * primary and one outline button, then the offer's terms line.
 */
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
    <div
      data-sticky-cta-hide
      className="flex flex-col items-center rounded-3xl bg-surface-band px-5 py-10 text-center sm:px-8 md:px-12 md:py-12"
    >
      <OfferBadge locale={locale} />
      <h2 className="mt-5 max-w-2xl text-balance font-display text-2xl font-bold tracking-tight md:text-3xl">
        {title ?? t.ctaTitle(name)}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{t.ctaText}</p>
      <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={signUpHref as Route}>
            {t.ctaPrimary}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href={pricingHref as Route}>{t.ctaSecondary}</Link>
        </Button>
      </div>
      <TrustSignals locale={locale} className="mt-6" />
    </div>
  );
}

/** Section heading of the catalogue pages. */
export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mb-5 scroll-mt-24 font-display text-2xl font-bold tracking-tight md:text-3xl"
    >
      {children}
    </h2>
  );
}
