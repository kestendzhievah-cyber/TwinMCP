import { Github, Twitter, Linkedin, ActivitySquare } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CookieSettingsLink } from "@/components/analytics/cookie-settings-link";
import type { Locale } from "@/lib/i18n/locales";
import { SOCIAL_LINKS, STATUS_URL, displayHost } from "@/lib/site-links";

type FooterLink = { href: string; label: string; external?: boolean };
type FooterColumn = { label: string; links: FooterLink[] };

// Points French visitors at the French page when one exists (home + its section
// anchors, pricing → /fr/tarifs, docs, blog, the Smithery migration landing,
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
        { href: homeHref(locale, "#features"), label: fr ? "Fonctionnalités" : "Features" },
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

const STRINGS = {
  en: {
    tagline: "MCPs as a Service. Run your MCP servers without managing infra.",
    rights: "All rights reserved.",
    status: "Service status",
  },
  fr: {
    tagline: "Le MCP en tant que service. Faites tourner vos serveurs MCP sans gérer d’infra.",
    rights: "Tous droits réservés.",
    status: "État du service",
  },
} as const;

export function MarketingFooter({ locale = "en" }: { locale?: Locale }) {
  const columns = buildColumns(locale);
  const s = STRINGS[locale];
  return (
    <footer className="rule-double mt-24">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="text-sm text-muted-foreground">{s.tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.label}>
              <h3 className="mb-3 text-xs font-medium smallcaps tracking-sc text-foreground">
                {col.label}
              </h3>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={`${col.label}-${l.label}`}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener noreferrer" : undefined}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* The card's address line: one centred row of small capitals between two rules. */}
        <p className="smallcaps tracking-sc mt-12 border-y border-border py-4 text-center text-xs text-muted-foreground">
          {["twinmcp.fr", "hello@twinmcp.fr", "security@twinmcp.fr"]
            .concat(STATUS_URL ? [displayHost(STATUS_URL)] : [])
            .join(" · ")}
        </p>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p className="lining text-xs text-muted-foreground">
            © {new Date().getFullYear()} TwinMCP. {s.rights}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CookieSettingsLink className=" px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" />
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            {SOCIAL_LINKS.github && (
              <a
                href={SOCIAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
