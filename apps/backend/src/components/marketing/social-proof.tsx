import { Box, KeyRound, Plug, RotateCcw } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { Section } from "./section";

// Verifiable product facts only — no testimonials, customer logos, user counts,
// ratings or uptime figures until we have real, consented ones (fabricated
// proof is a deceptive practice). Every line below is backed by the product.
const COPY = {
  en: {
    eyebrow: "Why trust it",
    title: "Isolated, encrypted, cancel anytime",
    stats: [
      { value: "70+", label: "MCPs in the catalog" },
      { value: "~2 min", label: "To get a server live" },
      { value: "0", label: "Dockerfiles or VPS to manage" },
    ],
    points: [
      {
        icon: Box,
        title: "One sandbox per server",
        body: "Each server runs in its own Upstash Box micro-VM, walled off from your other servers and from everyone else’s.",
      },
      {
        icon: KeyRound,
        title: "Encrypted secrets",
        body: "Tokens and connection strings are encrypted at rest with AES-256-GCM. Every request is authenticated with your API key.",
      },
      {
        icon: Plug,
        title: "An open standard",
        body: "MCP was published by Anthropic in November 2024. The same server works in every compatible client.",
      },
      {
        icon: RotateCcw,
        title: "No commitment",
        body: "No subscription to cancel. You start on free credit with no card, then top up a prepaid balance only if you want more. At zero, calls stop: nothing is charged unless you turn auto-recharge on.",
      },
    ],
  },
  fr: {
    eyebrow: "Nos garanties",
    title: "Isolé, chiffré, sans engagement",
    stats: [
      { value: "70+", label: "MCP au catalogue" },
      { value: "~2 min", label: "Pour mettre un serveur en ligne" },
      { value: "0", label: "Dockerfile ou VPS à gérer" },
    ],
    points: [
      {
        icon: Box,
        title: "Un sandbox par serveur",
        body: "Chaque serveur tourne dans sa propre micro-VM Upstash Box, isolée de vos autres serveurs comme de ceux des autres utilisateurs.",
      },
      {
        icon: KeyRound,
        title: "Secrets chiffrés",
        body: "Tokens et chaînes de connexion sont chiffrés au repos en AES-256-GCM. Chaque requête est authentifiée par votre clé API.",
      },
      {
        icon: Plug,
        title: "Un standard ouvert",
        body: "MCP a été publié par Anthropic en novembre 2024. Le même serveur fonctionne dans tous les clients compatibles.",
      },
      {
        icon: RotateCcw,
        title: "Sans engagement",
        body: "Aucun abonnement à résilier. Vous démarrez avec du crédit offert, sans carte, puis rechargez un solde prépayé seulement si vous en voulez plus. À zéro, les appels s’arrêtent : rien n’est prélevé, sauf si vous activez la recharge automatique.",
      },
    ],
  },
} as const;

export function SocialProof({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  // Sits right under the clients band, whose bottom hairline already closes
  // the block above, so no double rule on top of this one.
  return (
    <Section eyebrow={t.eyebrow} title={t.title} className="py-16 md:py-20">
      {/* A strip of figures between two hairlines, captions in small capitals. */}
      <div className="grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {t.stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center px-6 py-6 text-center md:py-8">
            <span className="lining text-4xl font-medium md:text-5xl">{s.value}</span>
            <span className="smallcaps tracking-sc mt-2 text-xs text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* The guarantees, one ledger row: bare pictogram in a hairline square,
          small-caps title, one plain line. */}
      <ul className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {t.points.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col bg-card p-6">
            <span className="grid h-9 w-9 place-items-center border border-border text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="smallcaps tracking-sc mt-4 text-lg font-medium">{title}</h3>
            <p className="mt-2 text-base text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
