import { Github, Twitter, Linkedin, ActivitySquare, ArrowRight } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { CookieSettingsLink } from "@/components/analytics/cookie-settings-link";
import type { Locale } from "@/lib/i18n/locales";
import { SOCIAL_LINKS, STATUS_URL, displayHost } from "@/lib/site-links";
import { EDITEUR } from "@/lib/legal/entity";

type FooterLink = { href: string; label: string; external?: boolean };
type FooterColumn = { label: string; links: FooterLink[] };

// Points French visitors at the French page when one exists (home + its section
// anchors #how-it-works, #marketplace and #faq, pricing → /fr/tarifs, docs, blog, the Smithery migration landing,
// guided setup → /fr/demo, security → /fr/securite, changelog → /fr/changelog,
// compare → /fr/comparer, MCP catalog → /fr/serveurs, solutions → /fr/solutions).
// English-only pages (the API reference anchor, use-cases) keep their
// unprefixed href; legal pages have their own FR/EN paths. Every link points at
// a real page: no "About" until one exists (lib/legal/entity.ts is still being
// filled in), and no link that silently lands on the home page. The status
// page and the social profiles come from lib/site-links.ts and only render when
// their NEXT_PUBLIC_* env var is set (none resolved on 2026-10-29).
function homeHref(locale: Locale, hash = ""): string {
  return (locale === "fr" ? "/fr" : "/") + hash;
}

function buildColumns(locale: Locale): FooterColumn[] {
  const fr = locale === "fr";
  return [
    {
      label: fr ? "Produit" : "Product",
      links: [
        {
          href: homeHref(locale, "#how-it-works"),
          label: fr ? "Comment ça marche" : "How it works",
        },
        { href: homeHref(locale, "#marketplace"), label: "Marketplace" },
        { href: fr ? "/fr/serveurs" : "/servers", label: fr ? "Catalogue MCP" : "MCP catalog" },
        { href: fr ? "/fr/solutions" : "/solutions", label: "Solutions" },
        { href: "/use-cases", label: fr ? "Cas d’usage" : "Use cases" },
        { href: fr ? "/fr/tarifs" : "/plans", label: fr ? "Tarifs" : "Pricing" },
        {
          href: fr ? "/fr/demo" : "/demo",
          label: fr ? "Installation accompagnée" : "Guided setup",
        },
      ],
    },
    {
      label: fr ? "Ressources" : "Resources",
      links: [
        { href: fr ? "/fr/docs" : "/docs", label: "Docs" },
        { href: "/docs#api", label: fr ? "Référence API" : "API reference" },
        ...(SOCIAL_LINKS.github
          ? [{ href: SOCIAL_LINKS.github, label: "GitHub", external: true }]
          : []),
        { href: homeHref(locale, "#faq"), label: "FAQ" },
        {
          href: fr ? "/fr/migrer-depuis-smithery" : "/migrate-from-smithery",
          label: fr ? "Migrer depuis Smithery" : "Migrate from Smithery",
        },
        { href: fr ? "/fr/comparer" : "/compare", label: fr ? "Comparer" : "Compare" },
      ],
    },
    {
      label: fr ? "Entreprise" : "Company",
      links: [
        { href: fr ? "/fr/blog" : "/blog", label: "Blog" },
        { href: fr ? "/fr/changelog" : "/changelog", label: fr ? "Nouveautés" : "Changelog" },
        { href: fr ? "/fr/securite" : "/security", label: fr ? "Sécurité" : "Security" },
        { href: "mailto:hello@twinmcp.fr", label: "Contact" },
      ],
    },
    {
      label: fr ? "Légal" : "Legal",
      links: [
        { href: fr ? "/legal/terms" : "/legal/en/terms", label: fr ? "Conditions" : "Terms" },
        {
          href: fr ? "/legal/privacy" : "/legal/en/privacy",
          label: fr ? "Confidentialité" : "Privacy",
        },
        {
          href: fr ? "/legal/mentions-legales" : "/legal/en/notice",
          label: fr ? "Mentions légales" : "Legal notice",
        },
        {
          href: "mailto:security@twinmcp.fr",
          label: fr ? "Signaler une faille" : "Report a vulnerability",
        },
      ],
    },
  ];
}

// "EU company" is printed only once lib/legal/entity.ts carries the real
// registration (spec §7.4 claims gate): no placeholder left in the publisher.
const ENTITY_FILLED = !Object.values(EDITEUR).some((v) => v.includes("[à compléter"));

const STRINGS = {
  en: {
    tagline: "MCPs as a Service. Run your MCP servers without managing infra.",
    rights: "All rights reserved.",
    status: "Service status",
    trust: [
      "Prices in euros",
      "Prepaid, no subscription",
      "GDPR",
      ...(ENTITY_FILLED ? ["EU company"] : []),
    ],
    trustLink: "DPA & sub-processors",
    trustHref: "/security",
    trademark:
      "Logos are trademarks of their respective owners; their use does not imply endorsement.",
  },
  fr: {
    tagline: "Le MCP en tant que service. Faites tourner vos serveurs MCP sans gérer d’infra.",
    rights: "Tous droits réservés.",
    status: "État du service",
    trust: [
      "Prix en euros",
      "Prépayé, sans abonnement",
      "RGPD",
      ...(ENTITY_FILLED ? ["Société européenne"] : []),
    ],
    trustLink: "DPA et sous-traitants",
    trustHref: "/fr/securite",
    // U+202F (narrow no-break space) before the semicolon, French typography.
    trademark:
      "Les logos sont des marques de leurs propriétaires respectifs\u202f; leur présence n’implique aucun partenariat.",
  },
} as const;

const LINK =
  "rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt";
const ICON_LINK =
  "grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// "Clear sky" footer (spec §4.10): the alternate light-blue band, the logo and
// pitch, four link columns, the trust line and the trademark line. When the
// page carries the sticky mobile CTA (`data-cta-location="sticky_mobile"`,
// spec §5.12), phones get 6rem of extra bottom room so the fixed bar never
// covers the last line (pure CSS :has, so every layout using this footer is
// covered without a prop).
export function MarketingFooter({ locale = "en" }: { locale?: Locale }) {
  const columns = buildColumns(locale);
  const s = STRINGS[locale];
  return (
    <footer className="mt-16 border-t border-border bg-surface-alt max-md:[body:has([data-cta-location^=sticky])_&]:pb-24">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.5fr_repeat(4,1fr)] md:gap-8">
          <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{s.tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.label}>
              <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal text-foreground">
                {col.label}
              </h2>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={`${col.label}-${l.label}`}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener noreferrer" : undefined}
                      className={LINK}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-border pt-6">
          {/* Trust line (spec §4.10): only claims the product backs today. */}
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {s.trust.map((item, i) => (
              <li key={item} className="inline-flex items-center gap-2">
                {i > 0 && <span aria-hidden>·</span>}
                {item}
              </li>
            ))}
            <li className="inline-flex items-center gap-2">
              <span aria-hidden>·</span>
              <a
                href={s.trustHref}
                className="inline-flex items-center gap-1 rounded-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.trustLink}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            {["twinmcp.fr", "hello@twinmcp.fr", "security@twinmcp.fr"]
              .concat(STATUS_URL ? [displayHost(STATUS_URL)] : [])
              .join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">{s.trademark}</p>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TwinMCP. {s.rights}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <CookieSettingsLink className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            {SOCIAL_LINKS.github && (
              <a
                href={SOCIAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className={ICON_LINK}
              >
                <Github className="h-4 w-4" />
              </a>
            )}
            {SOCIAL_LINKS.twitter && (
              <a
                href={SOCIAL_LINKS.twitter}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className={ICON_LINK}
              >
                <Twitter className="h-4 w-4" />
              </a>
            )}
            {SOCIAL_LINKS.linkedin && (
              <a
                href={SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className={ICON_LINK}
              >
                <Linkedin className="h-4 w-4" />
              </a>
            )}
            {STATUS_URL && (
              <a
                href={STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.status}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ActivitySquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.status}</span>
              </a>
            )}
            <ThemeToggle />
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
