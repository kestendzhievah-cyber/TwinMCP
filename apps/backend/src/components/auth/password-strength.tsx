"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";

type Rule = { label: string; test: (pw: string) => boolean };

const RULES: Rule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Lower- and uppercase letters", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
  { label: "A special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordScore(pw: string) {
  return RULES.reduce((s, r) => s + (r.test(pw) ? 1 : 0), 0);
}

export function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => passwordScore(password), [password]);

  if (!password) return null;

  const tone =
    score <= 1
      ? "bg-destructive"
      : score === 2
        ? "bg-amber-500"
        : score === 3
          ? "bg-yellow-400"
          : "bg-emerald-500";
  const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full ${tone} transition-all`}
            style={{ width: `${(score / RULES.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.label} className="flex items-center gap-1.5">
              {ok ? (
                <Check className="h-3 w-3 text-emerald-500" aria-hidden />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/60" aria-hidden />
              )}
              <span className={ok ? "text-foreground" : ""}>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
