import { ShieldCheck, Zap, Layers, Workflow } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

// One icon per reason, in order.
const ICONS = [Zap, Layers, Workflow, ShieldCheck];

// Verifiable facts only (catalog seed in scripts/seed-mcps.ts, pricing data): no
// timing claims beyond "about 2 minutes", no MCP that isn't installable.
type PanelCopy = {
  heading: string;
  reasons: { title: string; body: string }[];
  facts: { label: string; value: string; caption: string }[];
};

const COPY: Record<Locale, PanelCopy> = {
  en: {
    heading: "Why developers pick TwinMCP",
    reasons: [
      {
        title: "Ready in about 2 minutes",
        body: "Pick an MCP from the catalog, paste the server URL into your client. No Docker, no VPS to keep warm.",
      },
      {
        title: "Curated MCPs out of the box",
        body: "70+ MCPs in the catalog, including fetch, memory, time and Notion.",
      },
      {
        title: "One config, every IDE",
        body: "The same TwinMCP server URL drops into Cursor, Claude Code, Claude Desktop, Windsurf, Cline, Zed and VS Code.",
      },
      {
        title: "Isolated and encrypted",
        body: "Each server runs in its own sandbox. Secrets encrypted at rest (AES-256-GCM), one API key per server, live logs.",
      },
    ],
    facts: [
      { label: "Free tier", value: "1", caption: "server" },
      { label: "Official", value: "5", caption: "MCPs included" },
      { label: "Card", value: "0", caption: "credit cards asked" },
    ],
  },
  fr: {
    heading: "Pourquoi les développeurs choisissent TwinMCP",
    reasons: [
      {
        title: "Prêt en 2 minutes environ",
        body: "Choisissez un MCP dans le catalogue, collez l'URL du serveur dans votre client. Sans Docker, sans VPS à maintenir.",
      },
      {
        title: "Des MCPs prêts à l'emploi",
        body: "Plus de 70 MCPs au catalogue, dont fetch, memory, time et Notion.",
      },
      {
        title: "Une config, tous vos IDE",
        body: "La même URL de serveur TwinMCP fonctionne dans Cursor, Claude Code, Claude Desktop, Windsurf, Cline, Zed et VS Code.",
      },
      {
        title: "Isolé et chiffré",
        body: "Chaque serveur tourne dans son propre sandbox. Secrets chiffrés au repos (AES-256-GCM), une clé API par serveur, logs en direct.",
      },
    ],
    facts: [
      { label: "Gratuit", value: "1", caption: "serveur" },
      { label: "Officiels", value: "5", caption: "MCPs inclus" },
      { label: "Carte", value: "0", caption: "carte bancaire demandée" },
    ],
  },
};

// The free tier in three ledger cells, on the card at the foot of the panel.
// Exported so other auth surfaces can reuse the same ledger.
export function FreeTierFacts({
  locale = "en",
  className,
}: {
  locale?: Locale;
  className?: string;
}) {
  return (
    <dl className={cn("lining grid grid-cols-3 gap-4 text-center", className)}>
      {COPY[locale].facts.map(({ label, value, caption }) => (
        <div key={label}>
          <dt className="smallcaps tracking-sc text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-2xl font-medium">{value}</dd>
          <dd className="text-xs italic text-muted-foreground">{caption}</dd>
        </div>
      ))}
    </dl>
  );
}

// The reverse of the card: a shade darker bone behind a left hairline, the
// wordmark, a ruled ledger of reasons, and the card itself — the one piece of
// "product" on the page — sitting on the stacked-card shadow.
export function AuthPanel({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <div className="flex h-full flex-col justify-between border-l border-border bg-secondary/40 px-10 py-12 lg:px-12">
      <div>
        <Logo />
        <h2 className="mt-12 text-balance text-2xl font-medium md:text-3xl">{t.heading}</h2>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {t.reasons.map(({ title, body }, i) => {
            const Icon = ICONS[i];
            return (
              <li key={title} className="flex items-start gap-4 py-4">
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="smallcaps tracking-sc text-base font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The card itself — verifiable facts only, no testimonials. */}
      <div className="mt-10 border border-border bg-card p-6 text-center shadow-stack">
        <p className="smallcaps text-lg font-medium tracking-[0.14em]">TwinMCP</p>
        <p className="smallcaps mt-1 text-[0.625rem] tracking-[0.24em] text-muted-foreground">
          Managed MCP Runtimes
        </p>
        <div className="rule-double my-5" />
        <FreeTierFacts locale={locale} />
        <div className="my-5 h-px bg-border" />
        <p className="smallcaps tracking-sc text-xs text-muted-foreground">
          twinmcp.fr · hello@twinmcp.fr · security@twinmcp.fr
        </p>
      </div>
    </div>
  );
}
