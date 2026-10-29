"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";

type Rule = { id: string; test: (pw: string) => boolean };

const RULES: Rule[] = [
  { id: "length", test: (p) => p.length >= 8 },
  { id: "case", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: "number", test: (p) => /\d/.test(p) },
  { id: "special", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const COPY: Record<
  Locale,
  { rules: Record<string, string>; levels: [string, string, string, string] }
> = {
  en: {
    rules: {
      length: "At least 8 characters",
      case: "Lower- and uppercase letters",
      number: "A number",
      special: "A special character",
    },
    levels: ["Weak", "Fair", "Good", "Strong"],
  },
  fr: {
    rules: {
      length: "Au moins 8 caractères",
      case: "Minuscules et majuscules",
      number: "Un chiffre",
      special: "Un caractère spécial",
    },
    levels: ["Faible", "Moyen", "Bon", "Fort"],
  },
};

export function passwordScore(pw: string) {
  return RULES.reduce((s, r) => s + (r.test(pw) ? 1 : 0), 0);
}

export function PasswordStrength({
  password,
  locale = "en",
}: {
  password: string;
  locale?: Locale;
}) {
  const score = useMemo(() => passwordScore(password), [password]);
  const t = COPY[locale];

  if (!password) return null;

  // Meter ink follows the semantic set (DESIGN.md §6): oxblood while weak,
  // ochre while fair or good, racing green once strong.
  const tone = score <= 1 ? "bg-destructive" : score <= 3 ? "bg-warning" : "bg-success";
  const label =
    score <= 1 ? t.levels[0] : score === 2 ? t.levels[1] : score === 3 ? t.levels[2] : t.levels[3];

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden bg-secondary">
          <div
            className={`h-full ${tone} transition-all`}
            style={{ width: `${(score / RULES.length) * 100}%` }}
          />
        </div>
        <span className="smallcaps tracking-sc min-w-14 text-right text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className="flex items-center gap-1.5">
              {ok ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <span className={ok ? "text-foreground" : ""}>{t.rules[r.id]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
