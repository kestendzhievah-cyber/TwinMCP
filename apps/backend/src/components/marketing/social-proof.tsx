import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Box, FileCheck2, KeyRound, Wallet, type LucideIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import { Section } from "./section";

// Trust & security: verifiable product facts only. No testimonials, customer
// logos, user counts, ratings, uptime figures, certifications or hosting
// region until there are real, consented, confirmed ones (fabricated proof is
// a deceptive practice). Each guarantee reuses a claim the security page
// (security-content.tsx) or the FAQ already makes.
//
// Testimonials slot: once a customer gives written permission to be quoted,
// add a quote card row here (name, role, company, quote). Leave empty until then.

type Guarantee = {
  icon: LucideIcon;
  title: string;
  body: string;
  link?: { label: string; href: string };
};

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    stats: { value: string; label: string }[];
    guarantees: Guarantee[];
  }
> = {
  en: {
    eyebrow: "Trust & security",
    title: "Built to be trusted with your tools",
    stats: [
      { value: "70+", label: "MCPs in the catalogue" },
      { value: String(MATRIX_CLIENTS.length), label: "AI clients with a generated config" },
      { value: "~2 min", label: "To a live server" },
      { value: "0", label: "Dockerfiles or VPS to manage" },
    ],
    guarantees: [
      {
        icon: Box,
        title: "An isolated sandbox per server",
        body: "Each server runs in its own sandbox, walled off from your other servers and from everyone else’s.",
      },
      {
        icon: KeyRound,
        title: "Encrypted secrets",
        // Verbatim from the FAQ answer "Are my secrets safe?".
        body: "Secrets such as API tokens and connection strings are encrypted at rest with AES-256-GCM, every call is authenticated with your API key, and live logs show you what happens on every server.",
      },
      {
        icon: Wallet,
        title: "Prepaid",
        body: "You can’t be billed beyond your balance: at zero, calls stop and servers pause. No card is charged unless you turn on auto-recharge.",
      },
      {
        icon: FileCheck2,
        title: "GDPR · DPA · sub-processors listed",
        body: "Our sub-processors are listed on the security page, and the DPA is available on request.",
        link: { label: "Security & GDPR", href: "/security#dpa" },
      },
    ],
  },
  fr: {
    eyebrow: "Confiance et sécurité",
    title: "Conçu pour héberger vos outils en confiance",
    stats: [
      { value: "70+", label: "MCP au catalogue" },
      { value: String(MATRIX_CLIENTS.length), label: "Clients IA avec config générée" },
      { value: "~2 min", label: "Jusqu’à un serveur en ligne" },
      { value: "0", label: "Dockerfile ou VPS à gérer" },
    ],
    guarantees: [
      {
        icon: Box,
        title: "Un sandbox isolé par serveur",
        body: "Chaque serveur tourne dans son propre sandbox, isolé de vos autres serveurs comme de ceux des autres utilisateurs.",
      },
      {
        icon: KeyRound,
        title: "Secrets chiffrés",
        // Repris mot pour mot de la FAQ « Mes secrets sont-ils protégés ? ».
        body: "Vos secrets (tokens d’API, chaînes de connexion) sont chiffrés au repos en AES-256-GCM, chaque appel est authentifié par votre clé API, et les logs en direct vous montrent ce qui se passe sur chaque serveur.",
      },
      {
        icon: Wallet,
        title: "Prépayé",
        body: "Impossible d’être facturé au-delà de votre solde : à zéro, les appels s’arrêtent et les serveurs se mettent en pause. Aucune carte n’est débitée, sauf si vous activez la recharge automatique.",
      },
      {
        icon: FileCheck2,
        title: "RGPD · DPA · sous-traitants listés",
        body: "Nos sous-traitants sont listés sur la page sécurité, et le DPA est disponible sur demande.",
        link: { label: "Sécurité et RGPD", href: "/fr/securite#dpa" },
      },
    ],
  },
};

export function SocialProof({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section
      id="trust"
      eyebrow={t.eyebrow}
      title={t.title}
      className="scroll-mt-20 bg-surface-alt py-16 md:py-24"
      containerClassName="px-4 sm:px-6"
    >
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {t.stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col-reverse items-center gap-1 rounded-2xl border border-border bg-card p-5 text-center shadow-sm"
          >
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:mt-8 md:gap-6 lg:grid-cols-4">
        {t.guarantees.map(({ icon: Icon, title, body, link }) => (
          <li
            key={title}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-brand">
              <Icon aria-hidden className="h-5 w-5" />
            </span>
            <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
            <p className="flex-1 text-sm text-muted-foreground">{body}</p>
            {link && (
              <Link
                href={link.href as Route}
                data-cta-location="home_trust"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                {link.label}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
