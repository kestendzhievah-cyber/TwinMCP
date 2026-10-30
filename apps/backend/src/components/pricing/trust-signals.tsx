import { CreditCard, Gauge, Wallet } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { walletFacts } from "./wallet-copy";

const EN = walletFacts("en");
const FR = walletFacts("fr");

const SIGNALS = {
  en: [
    { icon: CreditCard, label: `${EN.signupCredit} free credit · no card` },
    { icon: Wallet, label: "No subscription · pay only for what you use" },
    { icon: Gauge, label: "Stops at zero · no surprise bills" },
  ],
  fr: [
    { icon: CreditCard, label: `${FR.signupCredit} de crédit offert · sans carte` },
    { icon: Wallet, label: "Sans abonnement · vous payez ce que vous utilisez" },
    { icon: Gauge, label: "Arrêt à zéro · aucune facture surprise" },
  ],
} as const;

// The pricing hero's "address line": one row of small-caps facts, each led by
// a bare engraved pictogram. The caller frames it between two hairlines.
export function TrustSignals({ locale = "en" }: { locale?: Locale }) {
  const signals = SIGNALS[locale];
  return (
    <ul className="smallcaps tracking-sc flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
      {signals.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
