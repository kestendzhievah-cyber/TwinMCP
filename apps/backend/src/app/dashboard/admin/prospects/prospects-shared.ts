// Shared, client-safe constants + helpers for the prospection CRM. Kept out of
// the Drizzle schema module on purpose so the browser bundle never pulls pg-core.

export const STATUSES = ["new", "contacted", "replied", "meeting", "won", "lost"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  replied: "A répondu",
  meeting: "RDV",
  won: "Gagné",
  lost: "Perdu",
};

export const STATUS_VARIANT: Record<Status, "secondary" | "success" | "destructive" | "outline"> = {
  new: "outline",
  contacted: "secondary",
  replied: "secondary",
  meeting: "success",
  won: "success",
  lost: "destructive",
};

// Probability a deal at each stage eventually closes — powers the weighted
// pipeline forecast (expected revenue = Σ value × probability).
export const STATUS_PROBABILITY: Record<Status, number> = {
  new: 0.1,
  contacted: 0.2,
  replied: 0.35,
  meeting: 0.6,
  won: 1,
  lost: 0,
};

// Ordered funnel stages (lost is not a stage — it's an exit). A prospect has
// "reached" a stage when its current status is at or beyond it in this order.
export const PIPELINE_ORDER: Status[] = ["new", "contacted", "replied", "meeting", "won"];

export interface ProspectRow {
  id: string;
  company: string;
  contactName: string | null;
  email: string | null;
  role: string | null;
  source: string | null;
  status: Status;
  estimatedValueEur: number;
  notes: string;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  // True when this prospect's email already has a TwinMCP account (conversion
  // signal). Server-computed in the list endpoint.
  hasAccount?: boolean;
}

export const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
export const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

// A prospect is "à relancer" when its follow-up date has passed and the deal is
// still live (not won/lost).
export function isDue(p: ProspectRow, nowMs: number): boolean {
  if (!p.nextActionAt || p.status === "won" || p.status === "lost") return false;
  return new Date(p.nextActionAt).getTime() <= nowMs;
}

// Expected-revenue forecast across the whole pipeline.
export function weightedPipeline(items: ProspectRow[]): number {
  return items.reduce((sum, p) => sum + p.estimatedValueEur * STATUS_PROBABILITY[p.status], 0);
}

// ─── Email templates ────────────────────────────────────────────────────────
// Each builds a subject + body personalised with the prospect. The admin picks
// one from the mail dropdown; it opens their mail client pre-filled.

export interface EmailTemplate {
  id: string;
  label: string;
  build: (p: ProspectRow) => { subject: string; body: string };
}

const SIGN = "— TwinMCP · https://twinmcp.fr";
const greet = (p: ProspectRow) => (p.contactName ? `Bonjour ${p.contactName},` : "Bonjour,");

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "premier",
    label: "Premier contact",
    build: (p) => ({
      subject: `${p.company} × TwinMCP — connectez votre IA à vos outils en 10 min`,
      body: [
        greet(p),
        "",
        "Je suis le fondateur de TwinMCP.",
        "",
        "Vos équipes utilisent déjà des assistants IA (ChatGPT, Claude, Cursor…), mais ils " +
          "restent coupés de vos outils internes. TwinMCP connecte l'IA à vos applications " +
          "(bases de données, CRM, docs, APIs) en quelques minutes — une seule URL, une seule " +
          "clé, hébergé et maintenu par nous.",
        "",
        `Pour ${p.company}, concrètement :`,
        "• Vos assistants IA accèdent à vos données en toute sécurité",
        "• Déploiement en 10 min, sans infrastructure à gérer",
        "• Éligible aux aides France 2030 « Osez l'IA »",
        "",
        "Auriez-vous 15 min cette semaine pour une démo sur un cas concret ?",
        "",
        "Bien à vous,",
        "",
        SIGN,
      ].join("\n"),
    }),
  },
  {
    id: "relance1",
    label: "Relance 1",
    build: (p) => ({
      subject: `Re : ${p.company} × TwinMCP`,
      body: [
        greet(p),
        "",
        "Je me permets de revenir vers vous — mon précédent message est peut-être passé inaperçu.",
        "",
        "En une phrase : TwinMCP connecte les assistants IA de vos équipes à vos outils internes " +
          "(bases de données, CRM, docs, code) en quelques minutes, de façon sécurisée.",
        "",
        `Est-ce un sujet d'actualité pour ${p.company} ? Si oui, 15 min cette semaine pour une démo ?`,
        "",
        "Bien à vous,",
        "",
        SIGN,
      ].join("\n"),
    }),
  },
  {
    id: "relance2",
    label: "Relance 2 (dernière)",
    build: (p) => ({
      subject: `Faut-il refermer le sujet ? — ${p.company}`,
      body: [
        greet(p),
        "",
        "Je ne veux surtout pas vous importuner. Si l'IA connectée à vos outils n'est pas " +
          "prioritaire en ce moment, dites-le moi et je n'insisterai plus.",
        "",
        "Si c'est simplement une question de timing, je peux vous recontacter au bon moment — " +
          "indiquez-moi une période qui vous conviendrait.",
        "",
        "Bien à vous,",
        "",
        SIGN,
      ].join("\n"),
    }),
  },
  {
    id: "postrdv",
    label: "Après un RDV",
    build: (p) => ({
      subject: `Suite à notre échange — ${p.company}`,
      body: [
        greet(p),
        "",
        "Merci pour le temps que vous m'avez accordé.",
        "",
        `Pour récapituler, TwinMCP permettrait à ${p.company} de :`,
        "• connecter vos assistants IA à vos outils métier en toute sécurité,",
        "• démarrer en quelques minutes, sans infrastructure à gérer,",
        "• potentiellement financer le projet via les aides France 2030 « Osez l'IA ».",
        "",
        "Prochaine étape : je vous prépare un accès de test. Dites-moi s'il reste une question " +
          "ouverte de votre côté.",
        "",
        "Bien à vous,",
        "",
        SIGN,
      ].join("\n"),
    }),
  },
];

export function mailtoHref(p: ProspectRow, tpl: EmailTemplate): string {
  const { subject, body } = tpl.build(p);
  return `mailto:${p.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
