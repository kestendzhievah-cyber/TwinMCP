import type { Locale } from "@/lib/i18n/locales";
import type { PublicPriceTable } from "@/lib/wallet/pricing";
import { PRICE_TABLE, TEN_EURO, walletFacts } from "./wallet-copy";

const COPY = {
  en: {
    caption: "Price list",
    item: "What you use",
    price: "Price",
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
    topupNote: (max: string) => `Prepaid, card via Stripe, up to ${max} at a time`,
    topupFrom: "from",
    buysTitle: (amount: string) => `What ${amount} buys`,
    buysNote: "Each line assumes the whole amount goes to that one item.",
    sizes: { small: "small", medium: "medium", large: "large" },
  },
  fr: {
    caption: "Grille tarifaire",
    item: "Ce que vous utilisez",
    price: "Prix",
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
    creditPrice: "offert",
    topup: "Recharges",
    topupNote: (max: string) => `Prépayées, carte via Stripe, jusqu’à ${max} par recharge`,
    topupFrom: "dès",
    buysTitle: (amount: string) => `Ce que ${amount} permettent`,
    buysNote: "Chaque ligne suppose que tout le montant va à ce seul poste.",
    sizes: { small: "small", medium: "medium", large: "large" },
  },
} as const;

const ROW = "grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-0.5 py-3";

/**
 * The public price list: every figure from lib/wallet/pricing.ts
 * (publicPriceTable, whatTenEuroBuys), never typed by hand. A ledger on the
 * card: hairline rows, lining figures, the notes the pricing module ships.
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

  return (
    <div className="mx-auto grid max-w-[960px] gap-6 md:grid-cols-[3fr_2fr]">
      <section
        aria-label={t.caption}
        className="border border-foreground/70 bg-card p-6 shadow-stack md:p-8"
      >
        <div className="flex items-baseline justify-between border-b border-foreground/40 pb-2">
          <p className="smallcaps tracking-sc text-xs font-medium text-muted-foreground">
            {t.item}
          </p>
          <p className="smallcaps tracking-sc text-xs font-medium text-muted-foreground">
            {t.price}
          </p>
        </div>
        <ul className="lining divide-y divide-border">
          <li className={ROW}>
            <span className="font-medium text-foreground">{t.calls}</span>
            <span className="text-right">
              <span className="text-xl font-medium">{f.per1000Calls}</span>{" "}
              <span className="text-sm italic text-muted-foreground">{t.perThousand}</span>
            </span>
            <span className="col-span-2 text-xs italic text-muted-foreground">{t.callsNote}</span>
          </li>
          <li className={ROW}>
            <span className="font-medium text-foreground">{t.compute(t.sizes.small)}</span>
            <span className="text-right">
              <span className="text-xl font-medium">{f.cpuHour.small}</span>{" "}
              <span className="text-sm italic text-muted-foreground">{t.perCpuHour}</span>
            </span>
            <span className="col-span-2 text-xs italic text-muted-foreground">{t.computeNote}</span>
          </li>
          <li className={ROW}>
            <span className="font-medium text-foreground">{t.larger}</span>
            <span className="text-right text-sm italic text-muted-foreground">{t.largerPrice}</span>
            <span className="col-span-2 text-xs italic text-muted-foreground">{t.largerNote}</span>
          </li>
          <li className={ROW}>
            <span className="font-medium text-foreground">{t.credit}</span>
            <span className="text-right">
              <span className="text-xl font-medium">{f.signupCredit}</span>{" "}
              <span className="text-sm italic text-muted-foreground">{t.creditPrice}</span>
            </span>
            <span className="col-span-2 text-xs italic text-muted-foreground">
              {t.creditNote(f.signupDays)}
            </span>
          </li>
          <li className={ROW}>
            <span className="font-medium text-foreground">{t.topup}</span>
            <span className="text-right">
              <span className="text-sm italic text-muted-foreground">{t.topupFrom}</span>{" "}
              <span className="text-xl font-medium">{f.minTopup}</span>
            </span>
            <span className="col-span-2 text-xs italic text-muted-foreground">
              {t.topupNote(f.maxTopup)}
            </span>
          </li>
        </ul>
        <ul className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          {table.notes[locale].map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col border border-border bg-card p-6 shadow-sm md:p-8">
        <h3 className="smallcaps tracking-sc text-lg font-medium">{t.buysTitle(f.signupCredit)}</h3>
        <ul className="lining mt-4 flex-1 divide-y divide-border border-y border-border">
          {TEN_EURO.examples[locale].map((line) => (
            <li key={line} className="py-3 text-sm text-foreground/90">
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs italic text-muted-foreground">{t.buysNote}</p>
      </section>
    </div>
  );
}
