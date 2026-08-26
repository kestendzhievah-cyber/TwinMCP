import { Github, Twitter, ActivitySquare } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CookieSettingsLink } from "@/components/analytics/cookie-settings-link";
import type { Locale } from "@/lib/i18n/locales";

type FooterLink = { href: string; label: string; external?: boolean };
type FooterColumn = { label: string; links: FooterLink[] };

// Prefixes /fr for links that actually have a French page (home + its section
// anchors, blog). English-only pages (docs, plans, servers, use-cases, legal)
// keep their unprefixed href.
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
        { href: "/servers", label: fr ? "Catalogue MCP" : "MCP catalog" },
        { href: "/use-cases", label: fr ? "Cas d’usage" : "Use cases" },
        { href: "/plans", label: fr ? "Tarifs" : "Pricing" },
      ],
    },
    {
      label: fr ? "Ressources" : "Resources",
      links: [
        { href: "/docs", label: "Docs" },
        { href: "/docs#api", label: fr ? "Référence API" : "API reference" },
        { href: "https://github.com/twinmcp", label: "GitHub", external: true },
        { href: homeHref(locale, "#faq"), label: "FAQ" },
      ],
    },
    {
      label: fr ? "Entreprise" : "Company",
      links: [
        { href: homeHref(locale), label: fr ? "À propos" : "About" },
        { href: fr ? "/fr/blog" : "/blog", label: "Blog" },
        { href: homeHref(locale), label: "Changelog" },
        { href: "mailto:hello@twinmcp.fr", label: "Contact" },
      ],
    },
    {
      label: fr ? "Légal" : "Legal",
      links: [
        { href: "/legal/terms", label: fr ? "Conditions" : "Terms" },
        { href: "/legal/privacy", label: fr ? "Confidentialité" : "Privacy" },
        { href: "mailto:security@twinmcp.fr", label: fr ? "Sécurité" : "Security" },
      ],
    },
  ];
}

const STRINGS = {
  en: {
    tagline: "MCPs as a Service. Run your MCP servers without managing infra.",
    rights: "All rights reserved.",
    status: "All systems operational",
  },
  fr: {
    tagline: "Le MCP en tant que service. Faites tourner vos serveurs MCP sans gérer d’infra.",
    rights: "Tous droits réservés.",
    status: "Tous les systèmes opérationnels",
  },
} as const;

export function MarketingFooter({ locale = "en" }: { locale?: Locale }) {
  const columns = buildColumns(locale);
  const s = STRINGS[locale];
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="text-sm text-muted-foreground">{s.tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.label}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">
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

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TwinMCP. {s.rights}
          </p>
          <div className="flex items-center gap-2">
            <CookieSettingsLink className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" />
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <a
              href="https://github.com/twinmcp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="https://twitter.com/twinmcp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="https://status.twinmcp.fr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Status"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ActivitySquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.status}</span>
            </a>
            <ThemeToggle />
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
