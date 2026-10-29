import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Section } from "@/components/marketing/section";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { ROTATION_OVERLAP_MS } from "@/lib/auth/key-scope";
import { EDITEUR, HEBERGEUR } from "@/lib/legal/entity";
import type { Locale } from "@/lib/i18n/locales";

// The Security & GDPR page (EN /security, FR /fr/securite; contract K3).
//
// Rule: ONLY controls that exist in the code, each one annotated below with the
// file that implements it. No certification (no SOC 2, no ISO 27001), no uptime
// SLA, no EU data residency, no region choice — and the page says so plainly.
// Sub-processors are the services the code actually calls (package.json + env),
// in line with the privacy policy (app/(marketing)/legal/en/privacy).

export const SECURITY_PATHS = {
  en: "/security",
  fr: "/fr/securite",
} as const satisfies Record<Locale, string>;

const DEMO = { en: "/demo", fr: "/fr/demo" } as const satisfies Record<Locale, string>;
const PRIVACY = { en: "/legal/en/privacy", fr: "/legal/privacy" } as const;
// Published in the site footer (components/marketing/footer.tsx) and DESIGN.md.
const SECURITY_EMAIL = "security@twinmcp.fr";

const AUDIT_DAYS = PLAN_CAPABILITIES.pro.auditRetentionDays;
const OVERLAP_HOURS = Math.round(ROTATION_OVERLAP_MS / 3_600_000);

interface Control {
  name: string;
  body: string;
}

// Order is fixed; each entry cites its source.
function controls(locale: Locale): Control[] {
  const fr = locale === "fr";
  return [
    // lib/crypto/config-encryption.ts — ALGORITHM "aes-256-gcm", random 12-byte
    // IV per write, auth tag checked on read; key from CONFIG_ENCRYPTION_KEY
    // (env, never in the DB). Callers: app/api/v2/servers/[id]/mcps/**,
    // admin MCP routes; the box access token too (lib/provisioning.ts).
    {
      name: fr ? "Secrets chiffrés au repos" : "Secrets encrypted at rest",
      body: fr
        ? "La configuration de chaque MCP (tokens d’API, chaînes de connexion) et le jeton d’accès de chaque box sont chiffrés en AES-256-GCM, avec un vecteur d’initialisation aléatoire à chaque écriture. La clé de chiffrement vit dans l’environnement du serveur, pas dans la base de données."
        : "Each MCP's configuration (API tokens, connection strings) and each box's access token are encrypted with AES-256-GCM, with a random initialisation vector on every write. The encryption key lives in the server environment, not in the database.",
    },
    // db/schema/platform.ts servers.box_id (one box per server row);
    // lib/provisioning.ts + lib/upstash/box-client.ts create it; the client URL
    // is always the proxy (lib/mcp/client-config.ts proxyUrl: "Never the raw
    // box endpoint"), which authenticates every request (lib/auth.ts).
    {
      name: fr ? "Une box isolée par serveur" : "One isolated box per server",
      body: fr
        ? "Chaque serveur TwinMCP tourne dans sa propre Upstash Box, une micro-VM qu’il ne partage avec aucun autre serveur. Votre client IA passe toujours par le proxy TwinMCP, qui vérifie votre clé API à chaque requête."
        : "Each TwinMCP server runs in its own Upstash Box, a micro-VM it shares with no other server. Your AI client always goes through the TwinMCP proxy, which checks your API key on every request.",
    },
    // lib/auth.ts — hashKey() = sha256; generateApiKey() returns the raw key
    // once (POST /api/v2/auth/keys response); only key_hash + a 12-char prefix
    // are stored (db/schema/core.ts api_keys).
    {
      name: fr ? "Clés API hachées, affichées une fois" : "API keys hashed, shown once",
      body: fr
        ? "Une clé API n’est affichée qu’une seule fois, à sa création. TwinMCP n’en garde qu’une empreinte SHA-256 et un court préfixe pour la reconnaître : une clé perdue ne peut pas être relue, seulement remplacée."
        : "An API key is shown once, when it is created. TwinMCP keeps only a SHA-256 hash and a short prefix to recognise it: a lost key cannot be read back, only replaced.",
    },
    // lib/auth/key-scope.ts (contract K1) — scopes "full" | "mcp_proxy",
    // keyAllowsServer / keyAllowsManagement, ROTATION_OVERLAP_MS (24 h),
    // isKeyUsable (revoked or past expires_at → rejected).
    {
      name: fr ? "Clés limitées à un serveur" : "Keys scoped to one server",
      body: fr
        ? `Une clé peut être limitée au proxy MCP, et à un seul serveur : celle qui finit en clair dans un fichier de configuration d’IDE n’ouvre ni l’API de gestion ni vos autres serveurs. Une rotation laisse l’ancienne clé fonctionner ${OVERLAP_HOURS} h, le temps de mettre les configurations à jour ; une révocation est immédiate.`
        : `A key can be limited to the MCP proxy, and to a single server: the key that ends up in plain text in an IDE config file opens neither the management API nor your other servers. A rotation keeps the old key working for ${OVERLAP_HOURS} hours while configs are updated; a revocation is immediate.`,
    },
    // lib/audit.ts + lib/audit/log.ts (logAudit); actions such as
    // api_key.create/revoke/rotate, server.*, mcp.*, plan.*; admin actions on a
    // client's account are logged under the client's userId
    // (app/api/v2/admin/clients/[id]/servers/route.ts). Shown on
    // dashboard/audit-logs for PLAN_CAPABILITIES.pro.auditRetentionDays.
    {
      name: fr ? "Journal d’audit" : "Audit log",
      body: fr
        ? `Création, rotation et révocation de clés, changements de serveurs et de MCP, changements d’offre : ces actions sur votre compte sont journalisées, y compris celles que notre équipe fait pour vous lors d’une installation accompagnée. Sur Pro, le tableau de bord affiche les ${AUDIT_DAYS} derniers jours.`
        : `Key creation, rotation and revocation, server and MCP changes, plan changes: these actions on your account are logged, including those our team performs for you during a guided setup. On Pro, the dashboard shows the last ${AUDIT_DAYS} days.`,
    },
    // Contract K2 — app/api/mcp/[serverSlug]/[mcpSlug]/route.ts sets
    // x-twinmcp-request-id on every response and error.data.requestId on
    // JSON-RPC errors (documented in components/docs/docs-facts.ts).
    {
      name: fr ? "Un identifiant par requête" : "A request id on every call",
      body: fr
        ? "Chaque réponse du proxy MCP porte un en-tête x-twinmcp-request-id, repris dans le corps des erreurs. Avec cet identifiant, nous retrouvons une requête précise sans que vous ayez à nous transmettre de données."
        : "Every MCP proxy response carries an x-twinmcp-request-id header, repeated in error bodies. With that id we can trace one specific request without you sending us any data.",
    },
    // app/api/v2/account/route.ts DELETE — deletes boxes, cancels Stripe,
    // deletes usage events, keys, memberships, the user row (servers cascade)
    // and the Supabase auth identity; audit_logs keep the row with user_id SET
    // NULL and ip scrubbed. UI: app/dashboard/settings/panel.tsx.
    {
      name: fr ? "Suppression du compte" : "Account deletion",
      body: fr
        ? "Depuis Paramètres, la suppression du compte arrête et détruit vos box, annule votre abonnement, efface serveurs, clés, historique d’usage et identité de connexion. Les lignes du journal d’audit conservées pour raisons légales sont anonymisées (identifiant et adresse IP retirés)."
        : "From Settings, deleting your account stops and destroys your boxes, cancels your subscription and erases servers, keys, usage history and your sign-in identity. Audit-log rows kept for legal reasons are anonymised (user id and IP address removed).",
    },
    // lib/analytics/consent.ts — separate "analytics" (PostHog) and "ads"
    // (Google Ads) choices; posthog-js and gtag.js load only after opt-in
    // (lib/analytics/funnel.ts, lib/analytics/google-ads.ts); withdrawal clears
    // the Google cookies (revokeGoogleAds).
    {
      name: fr ? "Consentement par finalité" : "Consent per purpose",
      body: fr
        ? "La mesure d’audience et la mesure publicitaire sont deux choix distincts. Aucun script d’analyse ni de publicité ne se charge avant votre accord, et vous pouvez le retirer à tout moment depuis les paramètres des cookies."
        : "Audience measurement and advertising measurement are two separate choices. No analytics or advertising script loads before you agree, and you can withdraw at any time from the cookie settings.",
    },
  ];
}

interface Processor {
  name: string;
  purpose: { en: string; fr: string };
}

// Each row verified in the code:
//   Hostinger  lib/legal/entity.ts HEBERGEUR (the VPS behind twinmcp.fr)
//   Upstash    @upstash/box, @upstash/redis, @upstash/ratelimit, @upstash/qstash
//   Supabase   @supabase/ssr, @supabase/supabase-js (auth); Postgres database
//   Stripe     stripe (lib/stripe.ts, webhooks/stripe)
//   Resend     resend (lib/email.ts)
//   PostHog    lib/analytics/funnel.ts + server.ts, default host eu.i.posthog.com
//   Sentry     @sentry/nextjs (instrumentation*.ts, when a DSN is set)
//   OpenAI     openai (lib/openai.ts embed(), used by /api/v2/context)
//   Google     lib/analytics/google-ads.ts (gtag.js after ads consent)
//   Axiom      lib/logger.ts (when AXIOM_TOKEN is set)
const PROCESSORS: Processor[] = [
  {
    name: HEBERGEUR.nom,
    purpose: {
      en: "Hosting of the application server (twinmcp.fr)",
      fr: "Hébergement du serveur applicatif (twinmcp.fr)",
    },
  },
  {
    name: "Upstash",
    purpose: {
      en: "MCP runtimes (one Upstash Box per server), rate limiting, job queue",
      fr: "Exécution des MCP (une Upstash Box par serveur), limitation de débit, file de tâches",
    },
  },
  {
    name: "Supabase",
    purpose: {
      en: "Sign-in and the application database",
      fr: "Connexion et base de données de l’application",
    },
  },
  {
    name: "Stripe",
    purpose: { en: "Payments and subscriptions", fr: "Paiements et abonnements" },
  },
  {
    name: "Resend",
    purpose: { en: "Transactional email", fr: "E-mails transactionnels" },
  },
  {
    name: "PostHog (EU cloud)",
    purpose: {
      en: "Product analytics after consent; cookieless page counts",
      fr: "Mesure d’audience après consentement ; comptage de pages sans cookie",
    },
  },
  {
    name: "Sentry",
    purpose: { en: "Error monitoring", fr: "Suivi des erreurs" },
  },
  {
    name: "OpenAI",
    purpose: {
      en: "Embeddings of TwinMCP Docs search queries",
      fr: "Embeddings des recherches dans TwinMCP Docs",
    },
  },
  {
    name: "Google (Google Ads)",
    purpose: {
      en: "Advertising conversion measurement, after consent",
      fr: "Mesure des conversions publicitaires, après consentement",
    },
  },
  {
    name: "Axiom",
    purpose: { en: "Infrastructure logs", fr: "Journaux d’infrastructure" },
  },
];

const COPY = {
  en: {
    eyebrow: "Security & GDPR",
    title: "How your servers, keys and data are protected",
    lead: "Only controls you can check in the product, each one described as it is built. No badges, no certification claims.",
    controlsEyebrow: "Controls",
    controlsTitle: "What is in place today",
    notTitle: "What TwinMCP does not offer",
    notBody:
      "TwinMCP holds no security certification (no SOC 2, no ISO 27001), offers no uptime SLA and no choice of data region. If your procurement requires one of these, tell us before you subscribe.",
    processorsEyebrow: "Sub-processors",
    processorsTitle: "Who processes data for TwinMCP",
    processorsLead:
      "The services TwinMCP itself relies on. The third-party APIs your own MCPs call (Notion, GitHub, your database…) are reached with your credentials, on your behalf.",
    head: ["Sub-processor", "Purpose"],
    transfers:
      "Ask us for the location of each sub-processor and the safeguards for any transfer. How we process your data:",
    privacy: "Privacy policy",
    dpaTitle: "Data Processing Agreement",
    dpaBody: "Available on request. Ask through the form (subject: DPA) or by email.",
    dpaCta: "Request the DPA",
    disclosureTitle: "Report a vulnerability",
    disclosureBody:
      "Write to the security address or use the form (subject: Security). Include the steps to reproduce and, for an MCP call, the request id.",
    disclosureCta: "Open the form",
  },
  fr: {
    eyebrow: "Sécurité & RGPD",
    title: "Comment vos serveurs, vos clés et vos données sont protégés",
    lead: "Uniquement des mesures vérifiables dans le produit, chacune décrite telle qu’elle est construite. Pas de badges, pas de certification revendiquée.",
    controlsEyebrow: "Mesures",
    controlsTitle: "Ce qui est en place aujourd’hui",
    notTitle: "Ce que TwinMCP ne propose pas",
    notBody:
      "TwinMCP ne détient aucune certification de sécurité (ni SOC 2, ni ISO 27001), ne propose pas de SLA de disponibilité ni de choix de la région des données. Si vos achats l’exigent, dites-le-nous avant de vous abonner.",
    processorsEyebrow: "Sous-traitants",
    processorsTitle: "Qui traite des données pour TwinMCP",
    processorsLead:
      "Les services sur lesquels TwinMCP s’appuie. Les API tierces appelées par vos propres MCP (Notion, GitHub, votre base de données…) le sont avec vos identifiants, pour votre compte.",
    head: ["Sous-traitant", "Finalité"],
    transfers:
      "Demandez-nous la localisation de chaque sous-traitant et les garanties encadrant les transferts. Comment nous traitons vos données :",
    privacy: "Politique de confidentialité",
    dpaTitle: "Accord de traitement des données (DPA)",
    dpaBody: "Disponible sur demande. Demandez-le via le formulaire (objet : DPA) ou par e-mail.",
    dpaCta: "Demander le DPA",
    disclosureTitle: "Signaler une vulnérabilité",
    disclosureBody:
      "Écrivez à l’adresse sécurité ou passez par le formulaire (objet : Sécurité). Indiquez les étapes pour reproduire et, pour un appel MCP, l’identifiant de requête.",
    disclosureCta: "Ouvrir le formulaire",
  },
} as const;

const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:h-px after:w-10 after:shrink-0 after:bg-border after:content-['']";
const LINK =
  "text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand";

export function SecurityContent({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const list = controls(locale);
  return (
    <>
      <section className="w-full py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className={EYEBROW_RULES}>{t.eyebrow}</p>
          <h1 className="display letterpress mx-auto mt-6 max-w-4xl text-balance text-4xl md:text-5xl lg:text-6xl">
            {t.title}
          </h1>
          <div className="mx-auto mt-8 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t.lead}
          </p>
        </div>
      </section>

      <Section bordered eyebrow={t.controlsEyebrow} title={t.controlsTitle}>
        <ol className="mx-auto max-w-4xl border-y border-foreground/50">
          {list.map((c, i) => (
            <li
              key={c.name}
              className="grid gap-2 border-b border-border py-5 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,14rem)_minmax(0,1fr)] sm:gap-6"
            >
              <span className="smallcaps lining text-base text-muted-foreground" aria-hidden>
                {i + 1}.
              </span>
              <h3 className="smallcaps tracking-sc text-base font-medium">{c.name}</h3>
              <p className="text-base text-muted-foreground">{c.body}</p>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-10 flex max-w-4xl gap-3 border border-warning/40 bg-warning/10 px-5 py-4 text-warning">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="smallcaps tracking-sc font-medium">{t.notTitle}</p>
            <p className="mt-1 text-sm">{t.notBody}</p>
          </div>
        </div>
      </Section>

      <Section
        bordered
        id="sub-processors"
        eyebrow={t.processorsEyebrow}
        title={t.processorsTitle}
        description={t.processorsLead}
      >
        <div className="mx-auto max-w-4xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4">{t.head[0]}</TableHead>
                <TableHead className="py-4">{t.head[1]}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROCESSORS.map((p) => (
                <TableRow key={p.name} className="hover:bg-transparent">
                  <TableCell className="align-top font-medium">{p.name}</TableCell>
                  <TableCell className="align-top text-muted-foreground">
                    {p.purpose[locale]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-sm text-muted-foreground">
          {t.transfers}{" "}
          <Link href={PRIVACY[locale] as Route} className={LINK}>
            {t.privacy}
          </Link>
        </p>
      </Section>

      <Section bordered>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div id="dpa" className="flex flex-col border border-border bg-card p-6">
            <h2 className="smallcaps tracking-sc text-lg font-medium">{t.dpaTitle}</h2>
            <p className="mt-3 flex-1 text-base text-muted-foreground">
              {t.dpaBody}{" "}
              <a
                href={`mailto:${EDITEUR.email}?subject=DPA`}
                className={`${LINK} font-mono text-sm`}
              >
                {EDITEUR.email}
              </a>
            </p>
            <Button asChild variant="outline" className="mt-6 self-start">
              <Link
                href={`${DEMO[locale]}?topic=dpa#request` as Route}
                data-cta-location="security_dpa"
              >
                {t.dpaCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div id="disclosure" className="flex flex-col border border-border bg-card p-6">
            <h2 className="smallcaps tracking-sc text-lg font-medium">{t.disclosureTitle}</h2>
            <p className="mt-3 flex-1 text-base text-muted-foreground">
              {t.disclosureBody}{" "}
              <a href={`mailto:${SECURITY_EMAIL}`} className={`${LINK} font-mono text-sm`}>
                {SECURITY_EMAIL}
              </a>
            </p>
            <Button asChild variant="outline" className="mt-6 self-start">
              <Link
                href={`${DEMO[locale]}?topic=security#request` as Route}
                data-cta-location="security_disclosure"
              >
                {t.disclosureCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
