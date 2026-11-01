"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { walletFacts } from "@/components/pricing/wallet-copy";

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

const EN = walletFacts("en");
const FR = walletFacts("fr");

// Spec §4.9. The credit amount comes from the wallet facts, never typed.
const COPY = {
  en: {
    closing: `Smithery is closing. Move your MCPs to TwinMCP in 2 minutes, with ${EN.signupCredit} on us.`,
    closed: `Smithery has closed. Move your MCPs to TwinMCP in 2 minutes, with ${EN.signupCredit} on us.`,
    action: "Migrate",
    href: "/migrate-from-smithery",
  },
  fr: {
    closing: `Smithery ferme. Migrez vos MCP vers TwinMCP en 2 minutes, ${FR.signupCredit} offerts.`,
    closed: `Smithery a fermé. Migrez vos MCP vers TwinMCP en 2 minutes, ${FR.signupCredit} offerts.`,
    action: "Migrer",
    href: "/fr/migrer-depuis-smithery",
  },
} as const;

interface SmitheryNoticeProps {
  locale?: Locale;
  /** `Date.now()` taken when the server rendered. The first render uses it so
   *  the hydrated markup matches the HTML; the effect then re-checks against
   *  the visitor's clock, so a page built before a boundary still switches
   *  wording or hides itself. */
  renderedAt: number;
  /**
   * Where the band is mounted. The announcement bar sits ABOVE the sticky
   * header (spec §4.9), so MarketingHeader renders it with `placement="top"`
   * on the home pages. The legacy page-level calls (`<SmitheryNotice>` inside
   * app/(marketing)/page.tsx and app/fr/page.tsx, which render under the
   * header) default to `"page"` and render nothing, so the band never shows
   * twice. Those calls can simply be removed.
   */
  placement?: "top" | "page";
}

// A one-line navy announcement bar: white text, the whole line a link to the
// locale's Smithery migration landing (/migrate-from-smithery,
// /fr/migrer-depuis-smithery). No rose on navy (contrast 2.92).
export function SmitheryNotice({
  locale = "en",
  renderedAt,
  placement = "page",
}: SmitheryNoticeProps) {
  const [phase, setPhase] = useState<Phase>(() => phaseAt(renderedAt));

  useEffect(() => {
    setPhase(phaseAt(Date.now()));
  }, []);

  if (placement !== "top" || !phase) return null;
  const t = COPY[locale];

  return (
    // Dark mode keeps a dark bar (surface-band) instead of flipping to a light strip.
    <div className="bg-foreground text-background dark:bg-surface-band dark:text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link
          href={t.href as Route}
          data-cta-location="smithery_notice"
          className="group flex min-h-10 items-center justify-center py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground dark:focus-visible:ring-ring dark:focus-visible:ring-offset-surface-band"
        >
          <span suppressHydrationWarning>
            {t[phase]}{" "}
            <span className="whitespace-nowrap font-semibold underline underline-offset-4 group-hover:decoration-2 dark:text-foreground">
              {t.action}&nbsp;<span aria-hidden>→</span>
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
