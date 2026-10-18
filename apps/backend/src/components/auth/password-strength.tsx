"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";

type Rule = { label: string; test: (pw: string) => boolean };

const RULES: Rule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Lower- and smallcaps letters", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
  { label: "A special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordScore(pw: string) {
  return RULES.reduce((s, r) => s + (r.test(pw) ? 1 : 0), 0);
}

export function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => passwordScore(password), [password]);

  if (!password) return null;

  // Meter ink follows the semantic set (DESIGN.md §6): oxblood while weak,
  // ochre while fair or good, racing green once strong.
  const tone = score <= 1 ? "bg-destructive" : score <= 3 ? "bg-warning" : "bg-success";
  const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

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
            <li key={r.label} className="flex items-center gap-1.5">
              {ok ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <span className={ok ? "text-foreground" : ""}>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
