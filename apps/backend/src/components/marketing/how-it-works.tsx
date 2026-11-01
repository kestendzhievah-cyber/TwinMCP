import type { Locale } from "@/lib/i18n/locales";
import { offerCopy } from "./offer-badge";
import { Section } from "./section";

// Three steps from sign-up to a connected client. Keep the HowTo JSON-LD of
// app/(marketing)/page.tsx and app/fr/page.tsx (PT2M) in step with this list.
// The client configs themselves live in the hero's config card.
const EN = offerCopy("en");
const FR = offerCopy("fr");

const COPY = {
  en: {
    eyebrow: "How it works",
    title: "Live in about 2 minutes",
    steps: [
      {
        title: `Sign up, ${EN.credit} credited.`,
        body: "No card. Your free credit is on your account the moment it’s created.",
      },
      {
        title: "Pick an MCP.",
        body: "One click from the catalogue, or, after your first top-up, your own npm or PyPI package. Stdio servers are bridged for you.",
      },
      {
        title: "Paste the URL in your client.",
        body: "Copy the config the dashboard generates for Cursor, Claude, VS Code, Windsurf, Cline or Zed.",
      },
    ],
  },
  fr: {
    eyebrow: "Comment ça marche",
    title: "En ligne en 2 minutes environ",
    steps: [
      {
        title: `Inscrivez-vous, ${FR.credit} crédités.`,
        body: "Sans carte : le crédit est sur votre compte dès sa création.",
      },
      {
        title: "Choisissez un MCP.",
        body: "Un clic dans le catalogue, ou, après votre première recharge, votre propre paquet npm ou PyPI. Les serveurs stdio sont pontés pour vous.",
      },
      {
        title: "Collez l’URL dans votre client.",
        body: "Copiez la config générée pour Cursor, Claude, VS Code, Windsurf, Cline ou Zed.",
      },
    ],
  },
} as const;

export function HowItWorks({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section
      id="how-it-works"
      eyebrow={t.eyebrow}
      title={t.title}
      className="scroll-mt-20 bg-surface-alt py-16 md:py-24"
      containerClassName="px-4 sm:px-6"
    >
      <ol className="relative grid gap-4 md:grid-cols-3 md:gap-6">
        {/* Connector between the step numbers; the white cards cover it, so it
            only shows in the gaps (≥md, where the cards sit side by side). */}
        <span
          aria-hidden
          className="absolute inset-x-[16%] top-[2.625rem] hidden h-px bg-input md:block"
        />
        {t.steps.map((s, i) => (
          <li
            key={s.title}
            className="relative flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand font-display text-base font-bold text-brand-foreground tabular-nums"
            >
              {i + 1}
            </span>
            <h3 className="font-display text-lg font-semibold tracking-tight">{s.title}</h3>
            <p className="text-base text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
