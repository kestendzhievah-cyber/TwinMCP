"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";

// Smithery stops its hosted proxy, URLs, API and accounts on 31 October 2026
// (source: https://smithery.ai/future). Until then the band announces it, for
// two months afterwards it says it happened, then it disappears. Boundaries are
// UTC instants; an hour either side of Paris midnight does not matter here.
const CLOSED_FROM = Date.UTC(2026, 10, 1); // 1 Nov 2026 00:00 UTC
const HIDDEN_FROM = Date.UTC(2027, 0, 1); // 1 Jan 2027 00:00 UTC

type Phase = "closing" | "closed" | null;

function phaseAt(ms: number): Phase {
  if (ms < CLOSED_FROM) return "closing";
  if (ms < HIDDEN_FROM) return "closed";
  return null;
}

const COPY = {
  en: {
    closing: "Smithery shuts down its hosting on 31 October — migrate your MCP servers",
    closed: "Smithery shut down its hosting on 31 October — migrate your MCP servers",
    href: "/migrate-from-smithery",
  },
  fr: {
    closing: "Smithery ferme son hébergement le 31 octobre — migrez vos serveurs MCP",
    closed: "Smithery a fermé son hébergement le 31 octobre — migrez vos serveurs MCP",
    href: "/fr/migrer-depuis-smithery",
  },
} as const;

interface SmitheryNoticeProps {
  locale?: Locale;
  /** `Date.now()` taken by the server page when it rendered. The first render
   *  uses it so the hydrated markup matches the static HTML (no layout shift on
   *  a fresh build); the effect then re-checks against the visitor's clock, so a
   *  page built before a boundary still switches wording or hides itself. */
  renderedAt: number;
}

// A thin info-tinted band under the header: one line, the whole line a link to
// the locale's Smithery migration landing (/migrate-from-smithery,
// /fr/migrer-depuis-smithery).
export function SmitheryNotice({ locale = "en", renderedAt }: SmitheryNoticeProps) {
  const [phase, setPhase] = useState<Phase>(() => phaseAt(renderedAt));

  useEffect(() => {
    setPhase(phaseAt(Date.now()));
  }, []);

  if (!phase) return null;
  const t = COPY[locale];

  return (
    <div className="border-b border-info/40 bg-info/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link
          href={t.href as Route}
          data-cta-location="smithery_notice"
          className="group flex min-h-10 items-center justify-center gap-2 py-2 text-center text-xs text-foreground sm:text-sm"
        >
          <span className="underline decoration-info/40 underline-offset-4 transition-colors group-hover:decoration-info">
            {t[phase]}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
