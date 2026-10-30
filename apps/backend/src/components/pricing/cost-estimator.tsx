"use client";

import { useId, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/locales";
import type { PublicPriceTable } from "@/lib/wallet/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ESTIMATE_DAYS,
  WORKLOADS,
  count,
  estimateMonthly,
  eurAmount,
  formatMicrosEur,
  type WorkloadId,
} from "./wallet-copy";

const COPY = {
  en: {
    title: "Estimate your usage",
    lead: "Move the numbers to match how you work. The estimate uses the public price list above.",
    servers: "Servers",
    hours: "Hours in use per day",
    calls: "Tool calls per day",
    workload: "CPU use while in use",
    workloads: {
      idle: "Light: mostly waiting for calls (1% of a core)",
      light: "Moderate (5% of a core)",
      heavy: "Heavy, e.g. a headless browser (25% of a core)",
    } satisfies Record<WorkloadId, string>,
    total: (days: number) => `Estimated cost over ${days} days`,
    compute: "Compute",
    callsLine: "Tool calls",
    cpuHours: (h: string) => `${h} active CPU-hours`,
    callCount: (n: string) => `${n} calls`,
    credit: (amount: string, days: string) =>
      `At this rate, the ${amount} sign-up credit lasts about ${days} days.`,
    creditForever: (amount: string) => `At this rate, the ${amount} sign-up credit is not used.`,
    creditLong: (amount: string, days: number) =>
      `At this rate, the ${amount} sign-up credit lasts its full ${days} days.`,
    caveat:
      "An estimate for small servers, not a quote: the CPU share is an assumption you set. You are charged for the CPU time your server actually uses, as the box measures it; medium and large servers cost more per CPU-hour.",
  },
  fr: {
    title: "Estimez votre usage",
    lead: "Ajustez les valeurs à votre façon de travailler. L’estimation utilise la grille tarifaire ci-dessus.",
    servers: "Serveurs",
    hours: "Heures d’utilisation par jour",
    calls: "Appels d’outils par jour",
    workload: "Usage CPU pendant l’utilisation",
    workloads: {
      idle: "Léger : surtout en attente d’appels (1 % d’un cœur)",
      light: "Modéré (5 % d’un cœur)",
      heavy: "Lourd, par exemple un navigateur headless (25 % d’un cœur)",
    } satisfies Record<WorkloadId, string>,
    total: (days: number) => `Coût estimé sur ${days} jours`,
    compute: "Calcul",
    callsLine: "Appels d’outils",
    cpuHours: (h: string) => `${h} heures de CPU actif`,
    callCount: (n: string) => `${n} appels`,
    credit: (amount: string, days: string) =>
      `À ce rythme, le crédit d’inscription de ${amount} dure environ ${days} jours.`,
    creditForever: (amount: string) =>
      `À ce rythme, le crédit d’inscription de ${amount} n’est pas entamé.`,
    creditLong: (amount: string, days: number) =>
      `À ce rythme, le crédit d’inscription de ${amount} tient ses ${days} jours.`,
    caveat:
      "Une estimation pour des serveurs small, pas un devis : la part de CPU est une hypothèse que vous choisissez. Vous payez le temps CPU que votre serveur utilise réellement, tel que la box le mesure ; les serveurs medium et large coûtent plus cher par heure CPU.",
  },
} as const;

const SELECT =
  "flex h-10 w-full border border-input bg-card px-3 py-2 text-sm text-foreground shadow-inner focus-visible:border-foreground focus-visible:outline-none";

function toNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Servers × hours a day × calls a day → euros over 30 days, priced with the
 * public price list the server page passes in (lib/wallet/pricing.ts →
 * publicPriceTable()), so the browser never reads env and never re-types a
 * price. The arithmetic is estimateMonthly() in wallet-copy.ts (unit-tested).
 */
export function CostEstimator({
  table,
  locale = "en",
}: {
  table: PublicPriceTable;
  locale?: Locale;
}) {
  const t = COPY[locale];
  const id = useId();
  const [servers, setServers] = useState(1);
  const [hours, setHours] = useState(8);
  const [calls, setCalls] = useState(500);
  const [workload, setWorkload] = useState<WorkloadId>("idle");

  const cpuShare = WORKLOADS.find((w) => w.id === workload)?.cpuShare ?? 0.01;
  const est = useMemo(
    () =>
      estimateMonthly(
        { servers, hoursPerDay: hours, callsPerDay: calls, cpuShare, days: ESTIMATE_DAYS },
        table
      ),
    [servers, hours, calls, cpuShare, table]
  );

  const fmtHours = est.cpuHours.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 1,
  });
  const credit = eurAmount(table.signupCreditEur, locale);
  let creditLine: string;
  if (!Number.isFinite(est.creditDays)) creditLine = t.creditForever(credit);
  else if (est.creditDays >= table.signupCreditDays)
    creditLine = t.creditLong(credit, table.signupCreditDays);
  else
    creditLine = t.credit(
      credit,
      est.creditDays.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
        maximumFractionDigits: est.creditDays < 1 ? 1 : 0,
      })
    );

  return (
    <div className="mx-auto max-w-[960px] border border-border bg-card shadow-sm">
      <div className="grid md:grid-cols-[3fr_2fr]">
        <form
          className="grid gap-5 p-6 sm:grid-cols-2 md:p-8"
          onSubmit={(e) => e.preventDefault()}
          aria-label={t.title}
        >
          <div className="sm:col-span-2">
            <h3 className="smallcaps tracking-sc text-lg font-medium">{t.title}</h3>
            <p className="mt-1 text-sm italic text-muted-foreground">{t.lead}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-servers`}>{t.servers}</Label>
            <Input
              id={`${id}-servers`}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={servers}
              onChange={(e) => setServers(Math.max(1, Math.min(50, toNumber(e.target.value))))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-hours`}>{t.hours}</Label>
            <Input
              id={`${id}-hours`}
              type="number"
              inputMode="decimal"
              min={0}
              max={24}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(24, toNumber(e.target.value))))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-calls`}>{t.calls}</Label>
            <Input
              id={`${id}-calls`}
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={calls}
              onChange={(e) => setCalls(Math.max(0, toNumber(e.target.value)))}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`${id}-workload`}>{t.workload}</Label>
            <select
              id={`${id}-workload`}
              className={SELECT}
              value={workload}
              onChange={(e) => setWorkload(e.target.value as WorkloadId)}
            >
              {WORKLOADS.map((w) => (
                <option key={w.id} value={w.id}>
                  {t.workloads[w.id]}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div
          className="flex flex-col border-t border-border p-6 md:border-l md:border-t-0 md:p-8"
          aria-live="polite"
        >
          <p className="smallcaps tracking-sc text-xs font-medium text-muted-foreground">
            {t.total(ESTIMATE_DAYS)}
          </p>
          <p className="lining mt-2 text-4xl font-medium">
            {formatMicrosEur(est.totalMicros, locale)}
          </p>
          <dl className="lining mt-5 divide-y divide-border border-y border-border text-sm">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt>
                {t.compute}
                <span className="block text-xs italic text-muted-foreground">
                  {t.cpuHours(fmtHours)}
                </span>
              </dt>
              <dd className="font-medium">{formatMicrosEur(est.computeMicros, locale)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt>
                {t.callsLine}
                <span className="block text-xs italic text-muted-foreground">
                  {t.callCount(count(est.calls, locale))}
                </span>
              </dt>
              <dd className="font-medium">{formatMicrosEur(est.callsMicros, locale)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-foreground/90">{creditLine}</p>
          <p className="mt-auto pt-4 text-xs italic text-muted-foreground">{t.caveat}</p>
        </div>
      </div>
    </div>
  );
}
