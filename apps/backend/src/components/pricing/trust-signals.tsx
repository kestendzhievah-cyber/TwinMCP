import { CreditCard, RotateCcw, ShieldCheck } from "lucide-react";

const signals = [
  { icon: CreditCard, label: "No credit card for free tier" },
  { icon: RotateCcw, label: "7-day money back" },
  { icon: ShieldCheck, label: "Cancel anytime · self-serve" },
];

export function TrustSignals() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
      {signals.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
