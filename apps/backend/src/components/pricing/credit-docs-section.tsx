import Link from "next/link";
import type { Route } from "next";
import type { Locale } from "@/lib/i18n/locales";
import { SERVERS } from "@/lib/servers/catalog";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { RPC_CODES } from "@/components/docs/docs-facts";
import { CREDIT_DOCS_ANCHOR, PRICE_TABLE, walletFacts } from "./wallet-copy";

// "Credits & pricing" on /docs and /fr/docs (anchor #credit). Prices from
// lib/wallet/pricing.ts (publicPriceTable) through wallet-copy.ts; the MCPs
// held back from the sign-up credit from lib/wallet/eligibility.ts; the
// zero-balance answer is contract W2 (HTTP 402, JSON-RPC -32008).

/** JSON-RPC error code of a tool call refused for lack of credit (contract W2). */
export const CREDIT_RPC_CODE = RPC_CODES.noCredit;

// Links in running text stay underlined (colour alone is not enough next to navy text).
const LINK =
  "font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

function excludedNames(): string[] {
  return PROMO_EXCLUDED_MCP_SLUGS.map((slug) => SERVERS.find((s) => s.slug === slug)?.name ?? slug);
}

export function CreditDocsSection({ locale = "en" }: { locale?: Locale }) {
  const fr = locale === "fr";
  const w = walletFacts(locale);
  const excluded = excludedNames().join(", ");
  const billing = "/dashboard/billing";
  const pricing = fr ? "/fr/tarifs" : "/plans";
  const notes = PRICE_TABLE.notes[locale];

  return (
    <section id={CREDIT_DOCS_ANCHOR} className="scroll-mt-24 py-12">
      <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
        {fr ? "Crédit et tarifs" : "Credits & pricing"}
      </h2>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {fr
          ? "TwinMCP n’a pas d’abonnement. Votre compte a un solde prépayé en euros, et chaque usage le fait baisser. Tant qu’il reste du crédit, tout fonctionne ; à zéro, tout s’arrête."
          : "TwinMCP has no subscription. Your account has a prepaid balance in euros, and every use draws it down. While there is credit, everything runs; at zero, everything stops."}
      </p>

      <div className="mt-6 divide-y divide-border">
        <div className="py-5 first:pt-0">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {fr ? "Ce qui est facturé" : "What is charged"}
          </h3>
          <ul
            role="list"
            className="mt-4 divide-y divide-border rounded-xl border border-border bg-card px-4 tabular-nums"
          >
            <li className="flex items-baseline justify-between gap-4 py-3">
              <span>{fr ? "Appels d’outils (tools/call)" : "Tool calls (tools/call)"}</span>
              <span className="whitespace-nowrap font-semibold">
                {w.per1000Calls} {fr ? "les 1 000" : "per 1,000"}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-3">
              <span>
                {fr
                  ? "Calcul, box small (heure de CPU actif)"
                  : "Compute, small box (active CPU-hour)"}
              </span>
              <span className="whitespace-nowrap font-semibold">{w.cpuHour.small}</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-3">
              <span>{fr ? "Calcul, box medium et large" : "Compute, medium and large boxes"}</span>
              <span className="text-right text-sm text-muted-foreground">
                {fr ? "le coût que la box déclare" : "the cost the box reports"}
              </span>
            </li>
          </ul>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 marker:text-muted-foreground">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>
              {fr ? (
                <>
                  Sont gratuits : <code>initialize</code>, <code>tools/list</code>, les pings, les
                  notifications, l&apos;ouverture de session et le test de connexion du tableau de
                  bord.
                </>
              ) : (
                <>
                  Free: <code>initialize</code>, <code>tools/list</code>, pings, notifications,
                  session handshakes and the dashboard&apos;s connection test.
                </>
              )}
            </li>
          </ul>
        </div>

        <div id="signup-credit" className="py-5">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {fr
              ? `Le crédit d’inscription de ${w.signupCredit}`
              : `The ${w.signupCredit} sign-up credit`}
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-7 marker:text-muted-foreground">
            {fr ? (
              <>
                <li>
                  Offert à chaque nouveau compte, sans carte bancaire, valable {w.signupDays} jours
                  après l&apos;inscription. Un seul par personne.
                </li>
                <li>
                  Il est promotionnel : il n&apos;a aucune valeur monétaire, n&apos;est ni
                  remboursable ni transférable, et il est consommé avant le crédit payé. Ce qui en
                  reste à la fin des {w.signupDays} jours expire.
                </li>
                <li>
                  Jusqu&apos;à votre première recharge : {w.creditServers} serveur, en box small,
                  avec jusqu&apos;à {w.smallMcps} MCP du catalogue plus TwinMCP Docs.
                </li>
                <li>
                  Les MCP qui exécutent des commandes, du code ou un navigateur ({excluded})
                  attendent votre première recharge.
                </li>
              </>
            ) : (
              <>
                <li>
                  Given to every new account, without a card, valid {w.signupDays} days after
                  sign-up. One per person.
                </li>
                <li>
                  It is promotional: it has no cash value, is neither refundable nor transferable,
                  and is spent before paid credit. Whatever is left after {w.signupDays} days
                  expires.
                </li>
                <li>
                  Until your first top-up: {w.creditServers} server, on a small box, with up to{" "}
                  {w.smallMcps} catalogue MCPs plus TwinMCP Docs.
                </li>
                <li>
                  MCPs that run commands, code or a browser ({excluded}) wait for your first top-up.
                </li>
              </>
            )}
          </ul>
        </div>

        <div id="zero-balance" className="py-5">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {fr ? "Quand le solde arrive à zéro" : "When the balance reaches zero"}
          </h3>
          <p className="mt-2 text-base leading-7">
            {fr ? (
              <>
                Les appels d&apos;outils facturables sont refusés avant d&apos;atteindre votre MCP,
                avec une erreur HTTP 402 et le code JSON-RPC <code>{CREDIT_RPC_CODE}</code> (voir{" "}
                <a href="#erreur-402" className={LINK}>
                  le dépannage
                </a>
                ), et vos serveurs se mettent en pause. Ces appels refusés ne sont pas facturés.
                Rien n&apos;est prélevé sur une carte, sauf si vous avez activé la recharge
                automatique. Le calcul déjà en cours peut faire descendre le solde légèrement sous
                zéro ({w.overdraft} au plus) ; ce montant est déduit de la recharge suivante.
              </>
            ) : (
              <>
                Billable tool calls are refused before they reach your MCP, with HTTP 402 and
                JSON-RPC code <code>{CREDIT_RPC_CODE}</code> (see{" "}
                <a href="#error-402" className={LINK}>
                  troubleshooting
                </a>
                ), and your servers pause. Those refused calls are not charged. Nothing is charged
                to a card unless you turned on auto-recharge. Compute that was already running can
                take the balance slightly below zero (at most {w.overdraft}); that amount comes out
                of the next top-up.
              </>
            )}
          </p>
        </div>

        <div id="top-ups" className="py-5">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {fr ? "Recharges et recharge automatique" : "Top-ups and auto-recharge"}
          </h3>
          <p className="mt-2 text-base leading-7">
            {fr ? (
              <>
                Dans <strong>Dashboard → Billing</strong>, rechargez {w.presets.join(", ")} ou tout
                montant entre {w.minTopup} et {w.maxTopup}, par carte via Stripe ; la TVA est
                calculée au paiement quand elle s&apos;applique. La première recharge débloque{" "}
                {w.fundedServers} serveurs, toutes les tailles de box et la publication de vos
                propres MCP. Le crédit payé n&apos;a pas de date d&apos;expiration : il reste
                disponible tant que votre compte est ouvert.
              </>
            ) : (
              <>
                In <strong>Dashboard → Billing</strong>, top up {w.presets.join(", ")} or any amount
                from {w.minTopup} to {w.maxTopup}, by card through Stripe; VAT is calculated at
                checkout where it applies. The first top-up unlocks {w.fundedServers} servers, every
                box size and publishing your own MCPs. Paid credit has no expiry date: it remains
                available while your account is open.
              </>
            )}
          </p>
          <p className="mt-3 text-base leading-7">
            {fr
              ? "La recharge automatique est désactivée par défaut. Activée, elle recharge le montant choisi sur la carte enregistrée quand le solde passe sous votre seuil, dans la limite d’un plafond mensuel que vous fixez. Vous la coupez à tout moment depuis la même page."
              : "Auto-recharge is off by default. When on, it tops up the amount you chose on your saved card whenever the balance falls below your threshold, up to a monthly cap you set. Turn it off anytime from the same page."}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            <Link href={billing as Route} className={LINK}>
              {fr ? "Ouvrir la facturation" : "Open billing"}
            </Link>{" "}
            ·{" "}
            <Link href={pricing as Route} className={LINK}>
              {fr ? "Grille tarifaire et estimateur" : "Price list and estimator"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
