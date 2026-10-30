import { Check, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";
import { maxMcpsForBoxSize } from "@/lib/plan-features";
import { FEATURES, type FeatureRow, type PlanId } from "./pricing-data";
import { ACCOUNT_STATES, walletFacts } from "./wallet-copy";

// The account before its first paid top-up (sign-up credit) and after it (pay
// as you go). Not plans: nothing is subscribed to, both spend the same wallet.
const planOrder: PlanId[] = ["free", "pro"];
const HIGHLIGHTED: PlanId = "pro";

const CHROME = {
  en: {
    features: "Features",
    recommended: "After your first top-up",
    included: "Included",
    notIncluded: "Not included",
  },
  fr: {
    features: "Fonctionnalités",
    recommended: "Après la première recharge",
    included: "Inclus",
    notIncluded: "Non inclus",
  },
} as const;

// FEATURES (pricing-data.ts) in French, keyed by the English group, label and
// value. The same facts, worded for the French pricing page (/fr/tarifs);
// src/__tests__/comparison-table.test.ts fails when a row has no translation.
const W = walletFacts("en");
const WF = walletFacts("fr");
const GROUP_FR: Record<string, string> = {
  Credit: "Crédit",
  Runtime: "Runtime",
  MCPs: "MCP",
  Access: "Accès",
  Observability: "Observabilité",
  Support: "Support",
};
export const FEATURE_COPY_FR: Record<string, { label: string; description?: string }> = {
  Credit: {
    label: "Crédit",
    description: `Le crédit d’inscription est promotionnel : sans carte, un par personne, consommé avant le crédit payé. Le crédit payé se recharge à partir de ${WF.minTopup}.`,
  },
  "Tool calls": {
    label: "Appels d’outils",
    description:
      "Les appels d’outils qui atteignent votre serveur MCP, erreurs d’outil comprises. La connexion, la liste des outils, les pings et les appels refusés par TwinMCP sont gratuits.",
  },
  Compute: {
    label: "Calcul",
    description: `Temps CPU actif, tel que la box le mesure : ${WF.cpuHour.small} par heure CPU en small ; ${WF.largerSizes}. Un serveur en pause n’en consomme pas.`,
  },
  "At zero balance": {
    label: "À solde nul",
    description:
      "Les appels d’outils sont refusés (HTTP 402) et les serveurs se mettent en pause. Rien n’est prélevé sur une carte, sauf si vous avez activé la recharge automatique.",
  },
  Servers: { label: "Serveurs", description: "Runtimes MCP isolés que vous pouvez lancer." },
  "Box sizes": {
    label: "Tailles de box",
    description: `small / medium / large par serveur : jusqu’à ${maxMcpsForBoxSize("small")}, ${maxMcpsForBoxSize("medium")} ou ${maxMcpsForBoxSize("large")} MCP à la fois.`,
  },
  "Official catalog": {
    label: "Catalogue officiel",
    description:
      "Avec le crédit offert, les MCP qui exécutent des commandes shell, du code ou un navigateur headless attendent votre première recharge.",
  },
  "Publish your own MCPs": {
    label: "Publier vos propres MCP",
    description: "Les MCP publiés restent privés à votre compte.",
  },
  "API keys": { label: "Clés API" },
  "Live logs": { label: "Logs en direct" },
  "Audit logs retention": { label: "Conservation des journaux d’audit" },
  "Usage metrics export": { label: "Export des métriques d’usage" },
  Channels: { label: "Canaux" },
};
const VALUE_FR: Record<string, string> = {
  [`${W.signupCredit} at sign-up, ${W.signupDays} days`]: `${WF.signupCredit} à l’inscription, ${WF.signupDays} jours`,
  [`Top-ups from ${W.minTopup}`]: `Recharges dès ${WF.minTopup}`,
  [`${W.per1000Calls} per 1,000`]: `${WF.per1000Calls} les 1 000`,
  [`${W.cpuHour.small} per CPU-hour`]: `${WF.cpuHour.small} par heure CPU`,
  [`From ${W.cpuHour.small} per CPU-hour`]: `Dès ${WF.cpuHour.small} par heure CPU`,
  "Calls stop": "Les appels s’arrêtent",
  "Calls stop, or auto-recharge": "Arrêt, ou recharge automatique",
  "Most MCPs": "La plupart des MCP",
  "All sizes": "Toutes",
  // Narrow no-break space, the French thousands separator.
  "5,000": "5 000",
  "90 days": "90 jours",
  Community: "Communauté",
  "Priority email": "E-mail prioritaire",
};

/** A feature group's heading in `locale` (English when no translation). */
export function featureGroupLabel(group: string, locale: Locale = "en"): string {
  return locale === "fr" ? (GROUP_FR[group] ?? group) : group;
}

/** A feature row's label and description in `locale` (English fallback). */
export function featureRowCopy(
  row: Pick<FeatureRow, "label" | "description">,
  locale: Locale = "en"
): { label: string; description?: string } {
  if (locale !== "fr") return { label: row.label, description: row.description };
  const fr = FEATURE_COPY_FR[row.label];
  if (!fr) return { label: row.label, description: row.description };
  return { label: fr.label, description: fr.description };
}

/** A text cell in `locale`: numbers and plan names pass through unchanged. */
export function featureValueLabel(value: string, locale: Locale = "en"): string {
  return locale === "fr" ? (VALUE_FR[value] ?? value) : value;
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Record<K, T[]> {
  return rows.reduce(
    (acc, row) => {
      const k = key(row);
      (acc[k] ??= []).push(row);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

function renderValue(value: string | boolean, locale: Locale) {
  const t = CHROME[locale];
  if (value === true) {
    return (
      <>
        <Check className="h-4 w-4 text-success" aria-hidden />
        <span className="sr-only">{t.included}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="h-4 w-4 text-muted-foreground/50" aria-hidden />
        <span className="sr-only">{t.notIncluded}</span>
      </>
    );
  }
  return <span className="text-foreground">{featureValueLabel(value, locale)}</span>;
}

// A ledger: small-caps column names on a firmer rule, group titles as
// small-caps sub-headings, hairline rows, lining figures (Table is `lining`).
// Two columns, so the ledger is held to the cards' width rather than
// stretched across the whole section. Shared by /plans and /fr/tarifs.
export function ComparisonTable({ locale = "en" }: { locale?: Locale }) {
  const t = CHROME[locale];
  const grouped = groupBy<FeatureRow, string>(FEATURES, (row) => row.group);
  const groupOrder = Array.from(new Set(FEATURES.map((f) => f.group)));

  return (
    <div className="mx-auto max-w-[860px] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-1/2 min-w-[180px] py-4 align-bottom">{t.features}</TableHead>
            {planOrder.map((id) => {
              const highlighted = id === HIGHLIGHTED;
              return (
                <TableHead
                  key={id}
                  className={cn("py-4 text-center align-bottom", highlighted && "text-foreground")}
                >
                  {/* col-reverse keeps the name first in the DOM while the
                      note line sits above it, like the card's eyebrow over
                      the name; names then share a baseline. */}
                  <div className="flex flex-col-reverse items-center gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {id === "free"
                        ? ACCOUNT_STATES[locale].credit
                        : ACCOUNT_STATES[locale].funded}
                    </span>
                    {highlighted && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {t.recommended}
                      </span>
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupOrder.map((group) => (
            <GroupBlock key={group} group={group} rows={grouped[group]} locale={locale} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupBlock({
  group,
  rows,
  locale,
}: {
  group: string;
  rows: FeatureRow[];
  locale: Locale;
}) {
  return (
    <>
      <TableRow className="border-foreground/40 hover:bg-transparent">
        <TableCell
          colSpan={planOrder.length + 1}
          className="smallcaps tracking-sc pb-2 pt-7 text-xs font-medium text-muted-foreground"
        >
          {featureGroupLabel(group, locale)}
        </TableCell>
      </TableRow>
      {rows.map((row) => {
        const copy = featureRowCopy(row, locale);
        return (
          <TableRow key={row.label}>
            <TableCell className="align-top">
              <div className="font-medium text-foreground">{copy.label}</div>
              {copy.description && (
                <div className="mt-0.5 text-xs italic text-muted-foreground">
                  {copy.description}
                </div>
              )}
            </TableCell>
            {planOrder.map((id) => (
              <TableCell key={id} className="text-center align-top">
                <div className="flex min-h-5 items-center justify-center">
                  {renderValue(row.values[id], locale)}
                </div>
              </TableCell>
            ))}
          </TableRow>
        );
      })}
    </>
  );
}
