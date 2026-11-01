import { Check, Layers, ShieldCheck, Zap } from "lucide-react";
import { BrandLogo, MCP_LOGO_KEY } from "@/components/brand/brand-logo";
import { OfferBadge } from "@/components/marketing/offer-badge";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { walletFacts } from "@/components/pricing/wallet-copy";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Which side panel an auth screen shows (docs/DESIGN.md, "Auth"):
 * - "offer": sign-up. The €10 credit front and centre: badge, headline, the
 *   three terms and what the credit covers.
 * - "default": sign-in, password screens, OAuth consent. No offer emphasis,
 *   just what TwinMCP does.
 */
export type AuthPanelVariant = "offer" | "default";

// Sign-up credit facts, from the wallet price list (lib/wallet/pricing.ts).
const W = { en: walletFacts("en"), fr: walletFacts("fr") };

// The AI clients TwinMCP generates a config for, in the marketing order.
// VS Code has no key on purpose: Microsoft's rules make it a text-only chip.
const CLIENTS: { key: string | null; label: Record<Locale, string> }[] = [
  { key: "cursor", label: { en: "Cursor", fr: "Cursor" } },
  { key: "claude-code", label: { en: "Claude Code", fr: "Claude Code" } },
  { key: "claude-desktop", label: { en: "Claude Desktop", fr: "Claude Desktop" } },
  { key: null, label: { en: "VS Code", fr: "VS Code" } },
  { key: "windsurf", label: { en: "Windsurf", fr: "Windsurf" } },
  { key: "cline", label: { en: "Cline", fr: "Cline" } },
  { key: "zed", label: { en: "Zed", fr: "Zed" } },
  { key: MCP_LOGO_KEY, label: { en: "Any MCP client", fr: "Tout client MCP" } },
];

// One icon per reason, in order.
const ICONS = [Zap, Layers, ShieldCheck];

// Verifiable facts only (catalogue seed, wallet price list): no timing claim
// beyond "about 2 minutes", no MCP that isn't installable.
const COPY = {
  en: {
    worksWith: "Works with",
    offerHeading: { figure: W.en.signupCredit, after: " credited the moment you sign up" },
    terms: ["No card", `${W.en.signupDays} days`, "No subscription"],
    offerSmall: `1 server with up to ${FREE_MCP_LIMIT} MCPs + TwinMCP Docs. Free credit is spent before paid credit; MCPs that run shell commands, code or a headless browser unlock with your first top-up.`,
    heading: "Your MCP servers, one URL away",
    reasons: [
      {
        title: "Ready in about 2 minutes",
        body: "Pick an MCP from the catalogue, paste the server URL into your client. No Docker, no VPS to keep warm.",
      },
      {
        title: "70+ MCPs out of the box",
        body: "Fetch, memory, time, Notion and more, each in its own isolated sandbox.",
      },
      {
        title: "Isolated and encrypted",
        body: "Secrets encrypted at rest (AES-256-GCM), one API key per server, live logs.",
      },
    ],
  },
  fr: {
    worksWith: "Compatible avec",
    offerHeading: { figure: W.fr.signupCredit, after: " crédités dès votre inscription" },
    terms: ["Sans carte", `${W.fr.signupDays} jours`, "Sans abonnement"],
    offerSmall: `1 serveur avec jusqu’à ${FREE_MCP_LIMIT} MCP + TwinMCP Docs. Le crédit offert est consommé avant le crédit payé ; les MCP qui exécutent des commandes shell, du code ou un navigateur headless se débloquent à la première recharge.`,
    heading: "Vos serveurs MCP, derrière une seule URL",
    reasons: [
      {
        title: "Prêt en 2 minutes environ",
        body: "Choisissez un MCP dans le catalogue, collez l’URL du serveur dans votre client. Sans Docker, sans VPS à maintenir.",
      },
      {
        title: "Plus de 70 MCP prêts à l’emploi",
        body: "Fetch, memory, time, Notion et d’autres, chacun dans son propre sandbox isolé.",
      },
      {
        title: "Isolé et chiffré",
        body: "Secrets chiffrés au repos (AES-256-GCM), une clé API par serveur, logs en direct.",
      },
    ],
  },
} as const;

/**
 * The AI clients as small white chips (logo + name). Logos sit on bg-card,
 * unmodified, in a "works with" sense only; the visible name labels each one,
 * so the marks are decorative for assistive tech.
 */
export function AuthWorksWith({
  locale = "en",
  className,
}: {
  locale?: Locale;
  className?: string;
}) {
  const label = COPY[locale].worksWith;
  return (
    <div className={className}>
      <p className="eyebrow">{label}</p>
      <ul aria-label={label} className="mt-3 flex flex-wrap gap-2">
        {CLIENTS.map(({ key, label: name }) => (
          <li
            key={name.en}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
          >
            {key && <BrandLogo slug={key} size={14} decorative />}
            <span>{name[locale]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The right-hand panel of the split auth layout (≥lg only): a light-blue band
// with rounded corners. Text on the band stays navy or muted; rose appears only
// as the solid offer badge and the ≥24px credit figure (AA on surface-band).
export function AuthPanel({
  locale = "en",
  variant = "default",
}: {
  locale?: Locale;
  variant?: AuthPanelVariant;
}) {
  const t = COPY[locale];
  return (
    <aside className="flex h-full flex-col justify-center rounded-3xl bg-surface-band p-10 xl:p-14">
      {variant === "offer" ? (
        <div className="max-w-md">
          <OfferBadge locale={locale} tone="solid" />
          <h2 className="mt-6 text-balance font-display text-3xl font-bold tracking-tight xl:text-4xl">
            <span className="text-primary">{t.offerHeading.figure}</span>
            {t.offerHeading.after}
          </h2>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-base font-medium text-foreground">
            {t.terms.map((term) => (
              <li key={term} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid h-5 w-5 place-items-center rounded-full bg-success text-success-foreground"
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="tabular-nums">{term}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">{t.offerSmall}</p>
          <AuthWorksWith locale={locale} className="mt-10" />
        </div>
      ) : (
        <div className="max-w-md">
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight">
            {t.heading}
          </h2>
          <ul className="mt-8 space-y-5">
            {t.reasons.map(({ title, body }, i) => {
              const Icon = ICONS[i];
              return (
                <li key={title} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-brand shadow-sm"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <AuthWorksWith locale={locale} className="mt-10" />
        </div>
      )}
    </aside>
  );
}
