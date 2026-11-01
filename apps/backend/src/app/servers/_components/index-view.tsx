import type { Route } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import { MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import {
  SERVERS,
  categoryLabel,
  getServersByCategory,
  localizedDescription,
  type ServerEntry,
} from "@/lib/servers/catalog";
import { serverPath, serversIndexPath } from "@/lib/seo/server-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { COPY } from "./copy";
import { OfferBadge } from "@/components/marketing/offer-badge";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { Breadcrumbs, HostCta, ServerMark } from "./parts";

const SIGN_UP: Record<Locale, string> = {
  en: "/sign-up",
  fr: "/fr/inscription",
};
const PRICING: Record<Locale, string> = { en: "/plans", fr: "/fr/tarifs" };

/** The one-word requirement stamp of a card, from the real config schema. */
function requirement(
  s: ServerEntry,
  locale: Locale
): { label: string; tone: "info" | "outline" | "secondary" } {
  const t = COPY[locale];
  if (s.hostMode === "local") return { label: t.local, tone: "info" };
  const props = Object.values(s.seed.configSchema.properties);
  if (props.some((p) => p.required && p.secret)) return { label: t.needsKey, tone: "outline" };
  if (props.some((p) => p.required)) return { label: t.needsSetting, tone: "outline" };
  return { label: t.noKey, tone: "secondary" };
}

export function ServersIndexView({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const groups = getServersByCategory();
  const crumbs = [
    { name: t.home, href: t.homeHref },
    { name: t.catalogue, href: serversIndexPath(locale) },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema(crumbs.map((c) => ({ name: c.name, url: c.href }))),
          itemListSchema(SERVERS.map((s) => ({ name: s.name, url: serverPath(s.slug, locale) }))),
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-14">
        <Breadcrumbs crumbs={crumbs} />

        <header className="mx-auto max-w-3xl pb-10 text-center md:pb-12">
          <p className="eyebrow">{t.indexEyebrow}</p>
          <h1 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t.indexTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            {t.indexLead}
          </p>
          <p className="mt-5 text-sm font-medium tabular-nums text-muted-foreground">
            {t.countLine(SERVERS.length, groups.length, MATRIX_CLIENTS.length)}
          </p>
          <div className="mt-6 flex justify-center">
            <OfferBadge locale={locale} />
          </div>
        </header>

        <nav aria-label={t.jumpTo} className="mb-12">
          <ul className="flex flex-wrap justify-center gap-2">
            {groups.map((g) => (
              <li key={g.key}>
                <a
                  href={`#cat-${g.key}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-input hover:text-brand"
                >
                  {categoryLabel(g.key, locale)}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {g.servers.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-14 md:space-y-16">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`cat-${g.key}`}>
              <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-3">
                <h2
                  id={`cat-${g.key}`}
                  className="scroll-mt-24 font-display text-2xl font-bold tracking-tight"
                >
                  {categoryLabel(g.key, locale)}
                </h2>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {t.serverCount(g.servers.length)}
                </span>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.servers.map((s) => {
                  const req = requirement(s, locale);
                  const locked = PROMO_EXCLUDED_MCP_SLUGS.includes(s.slug);
                  return (
                    <li key={s.slug} className="min-w-0">
                      <Link
                        href={serverPath(s.slug, locale) as Route}
                        className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <div className="flex items-start gap-3">
                          <ServerMark slug={s.slug} category={s.categoryKey} />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-display text-lg font-semibold tracking-tight text-foreground group-hover:text-brand">
                              {s.name}
                            </h3>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge variant={req.tone}>{req.label}</Badge>
                              {locked && (
                                <Badge variant="offer">
                                  <Lock className="h-3 w-3" aria-hidden />
                                  {t.unlocks}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                          {localizedDescription(s, locale)}
                        </p>
                        <p className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand">
                          {t.guide}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-16 border-t border-border pt-12 md:mt-20 md:pt-14">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t.ownTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{t.ownText}</p>
          </div>
          <HostCta
            name="MCP"
            title={t.indexCtaTitle}
            locale={locale}
            signUpHref={SIGN_UP[locale]}
            pricingHref={PRICING[locale]}
          />
        </section>
      </div>
      <StickyMobileCta locale={locale} />
    </>
  );
}
