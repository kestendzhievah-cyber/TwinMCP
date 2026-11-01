import { Gift } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import type { PublicPriceTable } from "@/lib/wallet/pricing";
import { offerFacts } from "@/components/marketing/offer-badge";
import { PRICE_TABLE, walletFacts } from "./wallet-copy";

const COPY = {
  en: {
    caption: "Price list",
    lead: "Same prices before and after your first top-up.",
    calls: "Tool calls",
    callsNote: "Only calls that reach your MCP server",
    perThousand: "per 1,000",
    compute: (size: string) => `Compute, ${size} server`,
    computeNote: "Active CPU time; a paused server uses none",
    larger: "Compute, medium and large servers",
    largerPrice: "metered",
    largerNote: "More per CPU-hour than small: the compute cost their box reports",
    perCpuHour: "per active CPU-hour",
    credit: "Sign-up credit",
    creditNote: (days: number) => `Promotional, no card, valid ${days} days`,
    creditPrice: "free",
    topup: "Top-ups",
    topupNote: (presets: string, max: string) =>
      `Prepaid by card via Stripe: ${presets}, or any amount up to ${max}`,
    topupFrom: "from",
  },
  fr: {
    caption: "Grille tarifaire",
    lead: "Les mêmes prix avant et après votre première recharge.",
    calls: "Appels d’outils",
    callsNote: "Seuls les appels qui atteignent votre serveur MCP",
    perThousand: "les 1 000",
    compute: (size: string) => `Calcul, serveur ${size}`,
    computeNote: "Temps CPU actif ; un serveur en pause n’en consomme pas",
    larger: "Calcul, serveurs medium et large",
    largerPrice: "au compteur",
    largerNote: "Plus cher par heure CPU que small : le coût de calcul que leur box déclare",
    perCpuHour: "par heure de CPU actif",
    credit: "Crédit d’inscription",
    creditNote: (days: number) => `Promotionnel, sans carte, valable ${days} jours`,
    creditPrice: "offerts",
    topup: "Recharges",
    topupNote: (presets: string, max: string) =>
      `Prépayées par carte via Stripe : ${presets}, ou tout montant jusqu’à ${max}`,
    topupFrom: "dès",
  },
} as const;

/** One line of the price list: what it is and a note on the left, the price on the right. */
function PriceRow({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-1 gap-x-6 gap-y-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-baseline">
      <span className="font-semibold text-foreground">{label}</span>
      <span className="tabular-nums sm:text-right">{children}</span>
      <span className="text-sm text-muted-foreground sm:col-span-2">{note}</span>
    </li>
  );
}

const FIGURE = "font-display text-xl font-bold tracking-tight text-foreground";
const UNIT = "text-sm text-muted-foreground";
const OFFER_FIGURE =
  "block font-display text-3xl font-extrabold tracking-tight text-primary tabular-nums";

/**
 * The public price list: every figure from lib/wallet/pricing.ts
 * (publicPriceTable, whatTenEuroBuys) through wallet-copy.ts, never typed by
 * hand. Left, a white card with the unit prices; right, the soft-pink offer
 * card with what the sign-up credit buys.
 */
export function PriceTable({
  locale = "en",
  table = PRICE_TABLE,
}: {
  locale?: Locale;
  table?: PublicPriceTable;
}) {
  const t = COPY[locale];
  const f = walletFacts(locale, table);
  const presets = f.presets.join(" · ");
  // What the sign-up credit buys: the shared offer copy (same cells and small
  // print as the home page's offer band), rendered from the wallet facts.
  const buys = offerFacts(locale);
  const [calls, cpu, server] = buys.cells;
  const [or, included] = buys.joiners;

  return (
    <div className="mx-auto grid max-w-[960px] gap-4 md:grid-cols-[3fr_2fr] md:items-start md:gap-6">
      <section
        aria-labelledby="price-list-title"
        className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 md:p-8"
      >
        <h3
          id="price-list-title"
          className="font-display text-lg font-semibold tracking-tight text-foreground"
        >
          {t.caption}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>
        <ul className="mt-5 divide-y divide-border border-t border-border pt-4">
          <PriceRow label={t.calls} note={t.callsNote}>
            <span className={FIGURE}>{f.per1000Calls}</span>{" "}
            <span className={UNIT}>{t.perThousand}</span>
          </PriceRow>
          <PriceRow label={t.compute("small")} note={t.computeNote}>
            <span className={FIGURE}>{f.cpuHour.small}</span>{" "}
            <span className={UNIT}>{t.perCpuHour}</span>
          </PriceRow>
          <PriceRow label={t.larger} note={t.largerNote}>
            <span className="text-sm font-medium text-muted-foreground">{t.largerPrice}</span>
          </PriceRow>
          <PriceRow label={t.credit} note={t.creditNote(f.signupDays)}>
            <span className={FIGURE}>{f.signupCredit}</span>{" "}
            <span className={UNIT}>{t.creditPrice}</span>
          </PriceRow>
          <PriceRow label={t.topup} note={t.topupNote(presets, f.maxTopup)}>
            <span className={UNIT}>{t.topupFrom}</span> <span className={FIGURE}>{f.minTopup}</span>
          </PriceRow>
        </ul>
        <ul className="mt-6 space-y-1.5 rounded-xl bg-secondary p-4 text-xs leading-5 text-muted-foreground">
          {table.notes[locale].map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="credit-buys-title"
        className="flex min-w-0 flex-col rounded-2xl border border-offer-border bg-offer p-5 sm:p-6 md:p-8"
      >
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-offer-foreground">
          <Gift className="h-4 w-4" aria-hidden />
          {buys.eyebrow}
        </p>
        <h3
          id="credit-buys-title"
          className="mt-2 font-display text-xl font-bold tracking-tight text-foreground"
        >
          {buys.title}
        </h3>
        <ul className="mt-5 flex flex-col gap-3">
          <li className="rounded-xl border border-offer-border bg-card p-4">
            <span className={OFFER_FIGURE}>{calls.figure}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{calls.label}</span>
          </li>
          <li aria-hidden className="flex justify-center">
            <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold text-offer-foreground">
              {or}
            </span>
          </li>
          <li className="rounded-xl border border-offer-border bg-card p-4">
            <span className={OFFER_FIGURE}>{cpu.figure}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{cpu.label}</span>
          </li>
          <li className="rounded-xl border border-offer-border bg-card p-4">
            <span className="block text-xs font-semibold uppercase tracking-wide text-offer-foreground">
              {included}
            </span>
            <span className="mt-1 block font-display text-xl font-bold tracking-tight text-foreground tabular-nums">
              {server.figure}
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{server.label}</span>
          </li>
        </ul>
        <p className="mt-5 text-xs leading-5 text-offer-foreground">{buys.smallPrint}</p>
      </section>
    </div>
  );
}
