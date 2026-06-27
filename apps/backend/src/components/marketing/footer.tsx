import { Github, Twitter, ActivitySquare } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

const columns: Array<{
  label: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}> = [
  {
    label: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#marketplace", label: "Marketplace" },
      { href: "/servers", label: "MCP catalog" },
      { href: "/use-cases", label: "Use cases" },
      { href: "/plans", label: "Pricing" },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs#api", label: "API reference" },
      { href: "https://github.com/twinmcp", label: "GitHub", external: true },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/#", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/#", label: "Changelog" },
      { href: "mailto:hello@twinmcp.fr", label: "Contact" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/#", label: "Terms" },
      { href: "/#", label: "Privacy" },
      { href: "/#", label: "Security" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="text-sm text-muted-foreground">
              MCPs as a Service. Run your MCP servers without managing infra.
            </p>
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
            © {new Date().getFullYear()} TwinMCP. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
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
              <span className="hidden sm:inline">All systems operational</span>
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
