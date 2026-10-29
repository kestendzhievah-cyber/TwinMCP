// The public changelog (/changelog, /fr/changelog). Every entry is a feature
// or fix that shipped, derived from `git log` since 2026-08-01 and from the
// current tree, worded for users: no internal jargon, no admin-only tooling,
// no promises. Entries dated 2026-10-27 are the week's release.
//
// Pure and client-safe. Unit-tested in src/__tests__/changelog.test.ts.

import type { Locale } from "@/lib/i18n/locales";

export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  /** ISO date (YYYY-MM-DD) the change shipped. */
  date: string;
  kind: ChangeKind;
  en: { title: string; body: string };
  fr: { title: string; body: string };
}

export const CHANGELOG: ChangelogEntry[] = [
  // ── This week ────────────────────────────────────────────────────────────
  {
    date: "2026-10-27",
    kind: "new",
    en: {
      title: "API keys scoped to the MCP proxy",
      body: "A key can now be limited to calling MCPs, optionally on a single server, and given an expiry date. A restricted key cannot manage your account, and an expired key is refused like a revoked one.",
    },
    fr: {
      title: "Clés API limitées au proxy MCP",
      body: "Une clé peut désormais être limitée aux appels MCP, éventuellement sur un seul serveur, avec une date d’expiration. Une clé restreinte ne peut pas gérer votre compte, et une clé expirée est refusée comme une clé révoquée.",
    },
  },
  {
    date: "2026-10-27",
    kind: "improved",
    en: {
      title: "Pause and Delete runtime are now separate",
      body: "Pause keeps your server’s data and restarts it on the next request or when you press Resume. Deleting the runtime is a separate action that asks for confirmation.",
    },
    fr: {
      title: "Pause et suppression du runtime séparées",
      body: "La pause conserve les données de votre serveur, qui redémarre à la requête suivante ou quand vous cliquez sur Reprendre. Supprimer le runtime est une action distincte, avec confirmation.",
    },
  },
  {
    date: "2026-10-27",
    kind: "new",
    en: {
      title: "Request IDs on every MCP proxy response",
      body: "Each response carries an x-twinmcp-request-id header, and errors from the proxy include the same ID and a link to the troubleshooting guide. Quote it when you contact support.",
    },
    fr: {
      title: "Identifiant de requête sur chaque réponse du proxy MCP",
      body: "Chaque réponse porte un en-tête x-twinmcp-request-id, et les erreurs du proxy reprennent cet identifiant avec un lien vers le guide de dépannage. Indiquez-le quand vous contactez le support.",
    },
  },
  {
    date: "2026-10-27",
    kind: "improved",
    en: {
      title: "Only tool calls count toward the daily quota",
      body: "Connecting a client, listing tools, pings and session handshakes are free. Reconnecting or switching IDEs no longer uses up your daily calls.",
    },
    fr: {
      title: "Seuls les appels d’outils comptent dans le quota",
      body: "Connecter un client, lister les outils, les pings et l’ouverture de session sont gratuits. Se reconnecter ou changer d’IDE n’entame plus vos appels du jour.",
    },
  },
  {
    date: "2026-10-27",
    kind: "fixed",
    en: {
      title: "A tool call is never sent twice",
      body: "When a server is waking up, TwinMCP only retries a tool call it knows never reached the server. If the outcome is uncertain, you get a clear error instead of a duplicate action.",
    },
    fr: {
      title: "Un appel d’outil n’est jamais envoyé deux fois",
      body: "Quand un serveur se réveille, TwinMCP ne relance un appel d’outil que s’il est certain qu’il n’a jamais atteint le serveur. En cas de doute, vous recevez une erreur claire plutôt qu’une action en double.",
    },
  },
  {
    date: "2026-10-27",
    kind: "new",
    en: {
      title: "Smithery migration guide",
      body: "A step-by-step guide to move your MCPs from Smithery to TwinMCP, in English and French.",
    },
    fr: {
      title: "Guide de migration depuis Smithery",
      body: "Un guide pas à pas pour déplacer vos MCP de Smithery vers TwinMCP, en français et en anglais.",
    },
  },
  {
    date: "2026-10-27",
    kind: "improved",
    en: {
      title: "Simpler pricing, now in French too",
      body: "Two plans: Free, and Pro at €14.99 a month or €135 a year, with the first month free on a first subscription. The pricing page is available in French.",
    },
    fr: {
      title: "Des tarifs plus simples, aussi en français",
      body: "Deux offres : Free, et Pro à 14,99 € par mois ou 135 € par an, avec le premier mois offert sur un premier abonnement. La page tarifs existe désormais en français.",
    },
  },
  {
    date: "2026-10-27",
    kind: "improved",
    en: {
      title: "Easier first steps",
      body: "Onboarding lets you pick MCPs from the catalogue, the dashboard shows a short activation checklist, and the home page shows the exact config for each supported client.",
    },
    fr: {
      title: "Des premiers pas plus simples",
      body: "L’onboarding vous fait choisir vos MCP dans le catalogue, le tableau de bord affiche une courte liste d’étapes, et la page d’accueil montre la configuration exacte pour chaque client compatible.",
    },
  },
  {
    date: "2026-10-27",
    kind: "new",
    en: {
      title: "API key rotation",
      body: "Replace an API key with a new one in one step from Dashboard → API keys.",
    },
    fr: {
      title: "Rotation des clés API",
      body: "Remplacez une clé API par une nouvelle en une étape depuis Dashboard → API keys.",
    },
  },
  {
    date: "2026-10-27",
    kind: "new",
    en: {
      title: "Guided setup and security pages",
      body: "Request a guided setup of your servers, and read how TwinMCP isolates servers and protects secrets.",
    },
    fr: {
      title: "Installation accompagnée et page sécurité",
      body: "Demandez une installation accompagnée de vos serveurs, et découvrez comment TwinMCP isole les serveurs et protège vos secrets.",
    },
  },

  // ── October 2026 ─────────────────────────────────────────────────────────
  {
    date: "2026-10-18",
    kind: "improved",
    en: {
      title: "New look",
      body: "A redesigned site and dashboard, a new logo, and a cookie banner that asks for consent purpose by purpose.",
    },
    fr: {
      title: "Nouvelle identité",
      body: "Un site et un tableau de bord redessinés, un nouveau logo, et un bandeau cookies qui demande votre accord finalité par finalité.",
    },
  },
  {
    date: "2026-10-13",
    kind: "new",
    en: {
      title: "Troubleshooting guide and French docs",
      body: "The docs gained a troubleshooting section that quotes each error message you may see, and a French version.",
    },
    fr: {
      title: "Guide de dépannage et documentation en français",
      body: "La documentation s’enrichit d’une section de dépannage qui cite chaque message d’erreur possible, et d’une version française.",
    },
  },
  {
    date: "2026-10-13",
    kind: "improved",
    en: {
      title: "14-day right of withdrawal in the terms",
      body: "The terms of service now state the statutory 14-day right of withdrawal.",
    },
    fr: {
      title: "Droit de rétractation de 14 jours dans les CGU",
      body: "Les conditions générales mentionnent désormais le droit légal de rétractation de 14 jours.",
    },
  },
  {
    date: "2026-10-01",
    kind: "new",
    en: {
      title: "New guides: Smithery alternatives, managed vs self-hosted",
      body: "Two comparison articles to help you choose where to run your MCP servers, in English and French.",
    },
    fr: {
      title: "Nouveaux guides : alternatives à Smithery, hébergé ou auto-hébergé",
      body: "Deux articles comparatifs pour choisir où faire tourner vos serveurs MCP, en français et en anglais.",
    },
  },

  // ── September 2026 ───────────────────────────────────────────────────────
  {
    date: "2026-09-29",
    kind: "fixed",
    en: {
      title: "More reliable billing",
      body: "Plan changes from checkout are applied reliably, and the prices shown match what checkout charges.",
    },
    fr: {
      title: "Facturation plus fiable",
      body: "Les changements d’offre issus du paiement sont appliqués de façon fiable, et les prix affichés correspondent à ceux du paiement.",
    },
  },
  {
    date: "2026-09-20",
    kind: "improved",
    en: {
      title: "HTTPS everywhere and English legal pages",
      body: "Every http:// request now redirects to https://. The terms, privacy policy and legal notice are available in English.",
    },
    fr: {
      title: "HTTPS partout et pages légales en anglais",
      body: "Toute requête http:// est désormais redirigée vers https://. Les CGU, la politique de confidentialité et les mentions légales existent en anglais.",
    },
  },
  {
    date: "2026-09-19",
    kind: "improved",
    en: {
      title: "Better readability",
      body: "Higher text contrast on the home page for accessibility.",
    },
    fr: {
      title: "Meilleure lisibilité",
      body: "Un contraste de texte renforcé sur la page d’accueil, pour l’accessibilité.",
    },
  },
  {
    date: "2026-09-09",
    kind: "improved",
    en: {
      title: "Email sign-in only",
      body: "Sign-in now uses your email address; the Google and GitHub buttons were removed.",
    },
    fr: {
      title: "Connexion par e-mail uniquement",
      body: "La connexion se fait désormais avec votre adresse e-mail ; les boutons Google et GitHub ont été retirés.",
    },
  },

  // ── August 2026 ──────────────────────────────────────────────────────────
  {
    date: "2026-08-30",
    kind: "improved",
    en: {
      title: "Faster dashboard",
      body: "The marketplace loads page by page, and audit logs and usage tables are paginated.",
    },
    fr: {
      title: "Tableau de bord plus rapide",
      body: "Le marketplace se charge page par page, et les journaux d’audit et tableaux d’usage sont paginés.",
    },
  },
  {
    date: "2026-08-29",
    kind: "new",
    en: {
      title: "Dozens of new MCPs in the catalogue",
      body: "Including Notion, Linear, Stripe, Postgres, Supabase, Neon, Figma, Firecrawl, Tavily, HubSpot, ClickUp, Discord, Qdrant, Pinecone and Kubernetes, with browsing by category.",
    },
    fr: {
      title: "Des dizaines de nouveaux MCP au catalogue",
      body: "Dont Notion, Linear, Stripe, Postgres, Supabase, Neon, Figma, Firecrawl, Tavily, HubSpot, ClickUp, Discord, Qdrant, Pinecone et Kubernetes, avec une navigation par catégorie.",
    },
  },
  {
    date: "2026-08-27",
    kind: "new",
    en: {
      title: "Marketplace search and filters",
      body: "Search the catalogue, filter by runtime and category, sort, open a detail view, and see which MCPs are already installed.",
    },
    fr: {
      title: "Recherche et filtres du marketplace",
      body: "Cherchez dans le catalogue, filtrez par runtime et par catégorie, triez, ouvrez une fiche détaillée et voyez quels MCP sont déjà installés.",
    },
  },
  {
    date: "2026-08-26",
    kind: "improved",
    en: {
      title: "Faster MCP connections",
      body: "Dashboard pages and MCP proxy requests respond faster.",
    },
    fr: {
      title: "Connexions MCP plus rapides",
      body: "Les pages du tableau de bord et les requêtes du proxy MCP répondent plus vite.",
    },
  },
  {
    date: "2026-08-24",
    kind: "fixed",
    en: {
      title: "Safer, clearer dashboard",
      body: "Destructive actions ask for confirmation, checkout errors are shown instead of failing silently, and the onboarding lets you go back a step.",
    },
    fr: {
      title: "Un tableau de bord plus sûr et plus clair",
      body: "Les actions destructrices demandent confirmation, les erreurs de paiement s’affichent au lieu d’échouer en silence, et l’onboarding permet de revenir en arrière.",
    },
  },
  {
    date: "2026-08-09",
    kind: "fixed",
    en: {
      title: "Servers no longer stay stuck while provisioning",
      body: "A server that stalls while provisioning is flagged automatically, so the Start button comes back and you can retry.",
    },
    fr: {
      title: "Les serveurs ne restent plus bloqués au provisionnement",
      body: "Un serveur bloqué pendant son provisionnement est signalé automatiquement : le bouton Démarrer réapparaît et vous pouvez relancer.",
    },
  },
];

export interface ChangelogMonth {
  /** "YYYY-MM". */
  key: string;
  /** "October 2026" / "octobre 2026". */
  label: string;
  entries: ChangelogEntry[];
}

const MONTHS: Record<Locale, string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  fr: [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ],
};

/** "October 2026" (en) or "octobre 2026" (fr) for a "YYYY-MM…" date. */
export function monthLabel(date: string, locale: Locale = "en"): string {
  const [year, month] = date.split("-");
  const name = MONTHS[locale][Number(month) - 1];
  if (!name || !year) throw new Error(`Invalid changelog date: ${date}`);
  return `${name} ${year}`;
}

/** "27 October 2026" (en) or "27 octobre 2026" (fr), with no time-zone drift. */
export function dayLabel(date: string, locale: Locale = "en"): string {
  const day = Number(date.split("-")[2]);
  return `${day} ${monthLabel(date, locale)}`;
}

/**
 * Newest month first, newest entry first within a month; entries sharing a
 * date keep their source order (Array.prototype.sort is stable).
 */
export function groupChangelogByMonth(
  entries: ChangelogEntry[],
  locale: Locale = "en"
): ChangelogMonth[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const months: ChangelogMonth[] = [];
  for (const entry of sorted) {
    const key = entry.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = { key, label: monthLabel(entry.date, locale), entries: [] };
      months.push(month);
    }
    month.entries.push(entry);
  }
  return months;
}

/** Date of the most recent entry, for metadata and the sitemap. */
export function latestChangelogDate(entries: ChangelogEntry[] = CHANGELOG): string {
  return entries.reduce((max, e) => (e.date > max ? e.date : max), "");
}
