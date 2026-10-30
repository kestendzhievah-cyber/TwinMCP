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
import { Badge } from "@/components/ui/badge";
import { COPY } from "./copy";
import { Breadcrumbs, HostCta } from "./parts";

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

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
        <Breadcrumbs crumbs={crumbs} />

        <header className="pb-14 text-center md:pb-16">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            {t.indexEyebrow}
          </p>
          <h1 className="display letterpress mt-6 text-5xl md:text-6xl lg:text-7xl">
            {t.indexTitle}
          </h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t.indexLead}
          </p>
          <p className="smallcaps tracking-sc lining mt-8 text-xs text-muted-foreground">
            {t.countLine(SERVERS.length, groups.length, MATRIX_CLIENTS.length)}
          </p>
        </header>

        <div className="rule-double space-y-16 pt-14">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`cat-${g.key}`}>
              <div className="mb-6 flex items-center gap-4">
                <h2
                  id={`cat-${g.key}`}
                  className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']"
                >
                  {categoryLabel(g.key, locale)}
                </h2>
                <span aria-hidden className="h-px flex-1 bg-border" />
                <span className="smallcaps tracking-sc lining text-xs text-muted-foreground">
                  {t.serverCount(g.servers.length)}
                </span>
              </div>
              <ul className="grid gap-5 md:grid-cols-2">
                {g.servers.map((s) => {
                  const req = requirement(s, locale);
                  return (
                    <li key={s.slug}>
                      <Link
                        href={serverPath(s.slug, locale) as Route}
                        className="group flex h-full flex-col border border-border bg-card p-6 transition-colors hover:border-foreground/60"
                      >
                        <div>
                          <Badge variant={req.tone}>{req.label}</Badge>
                        </div>
                        <h3 className="smallcaps tracking-sc mt-4 text-xl font-medium group-hover:underline group-hover:decoration-brand group-hover:underline-offset-[6px]">
                          {s.name}
                        </h3>
                        <p className="mt-2 text-base text-muted-foreground">
                          {localizedDescription(s, locale)}
                        </p>
                        <p className="smallcaps tracking-sc mt-auto pt-5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
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

        <section className="rule-double mt-20 pt-14">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-medium md:text-3xl">{t.ownTitle}</h2>
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
    </>
  );
}
