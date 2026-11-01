"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/marketing/logo";
import { CreditMeter } from "@/components/billing/credit-meter";
import {
  balanceTone,
  daysLeftLabel,
  promoShare,
  TONE_CHIP,
  TONE_FIGURE,
  TONE_SURFACE,
} from "@/components/billing/balance-tone";
import { PRICE_TABLE, walletFacts } from "@/components/pricing/wallet-copy";
import type { Plan } from "@/db/schema/core";
import {
  BILLING_HREF,
  formatCredit,
  type NudgeLevel,
  type NudgeReason,
} from "@/lib/billing/upgrade-state";
import { eurToMicros } from "@/lib/wallet/pricing";
import { track } from "@/lib/analytics/funnel";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ListChecks,
  LayoutGrid,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Store,
  Target,
  Upload,
  Users,
  CreditCard,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

const links: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/servers", label: "Servers", icon: Boxes },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/mcps", label: "Publish MCP", icon: Upload },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/audit-logs", label: "Audit logs", icon: ScrollText },
  { href: "/dashboard/billing", label: "Credits", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Team workspaces are no longer sold. The Team link follows the same rule as
// app/dashboard/team/page.tsx: grandfathered Team subscribers, plus users who
// already belong to a teamspace (e.g. invited by a Team subscriber). The layout
// knows the membership and passes `showTeam`; without it, only the plan counts.
function visibleLinks(showTeam: boolean) {
  return showTeam ? links : links.filter((l) => l.href !== "/dashboard/team");
}

/** The wallet as the layout read it, for the balance pill card and the mobile chip. */
export interface NavBalance {
  totalMicros: number;
  funded: boolean;
  level: NudgeLevel;
  reason: NudgeReason;
  /** Live (unexpired) free credit. */
  promoMicros: number;
  /** Whole days until the free credit expires (null when none is left). */
  promoDaysLeft: number | null;
}

const FACTS = walletFacts("en");

// "One rose primary per viewport" (docs/DESIGN.md §3). The pill card's Top up
// is rose only while the page itself shows no rose button: the overview's next
// setup step, the low-balance strip, a page's own primary (Create server, Add
// €25…) take precedence. `class~=` matches the default Button's whole
// `bg-primary` token, never outline / ghost buttons.
const PAGE_ROSE = 'a[class~="bg-primary"], button[class~="bg-primary"]';

function usePagePrimaryInView(pathname: string): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setInView(visible.size > 0);
    });
    // Pages swap buttons as they load or change state (dialogs, tabs, a
    // completed step): re-collect the rose buttons on DOM changes, once a frame.
    let observed = new Set<Element>();
    let frame = 0;
    const collect = () => {
      frame = 0;
      const next = new Set(main.querySelectorAll(PAGE_ROSE));
      for (const el of observed) {
        if (next.has(el)) continue;
        io.unobserve(el);
        visible.delete(el);
      }
      for (const el of next) if (!observed.has(el)) io.observe(el);
      observed = next;
      setInView(visible.size > 0);
    };
    collect();
    const mo =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            if (!frame) frame = requestAnimationFrame(collect);
          });
    mo?.observe(main, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      mo?.disconnect();
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return inView;
}
const SIGNUP_MICROS = eurToMicros(PRICE_TABLE.signupCreditEur);
const eur = (micros: number) => formatCredit(micros, { precise: false });

export function DashboardNav({
  email,
  plan,
  isAdmin = false,
  prospectsDue = 0,
  attentionCount = 0,
  showTeam = plan === "team",
  balance = null,
}: {
  email: string;
  plan: Plan;
  isAdmin?: boolean;
  prospectsDue?: number;
  attentionCount?: number;
  /** Team plan OR an existing teamspace membership (computed by the layout). */
  showTeam?: boolean;
  /** The wallet as the layout read it (null: unavailable, the pill is hidden). */
  balance?: NavBalance | null;
}) {
  const pathname = usePathname();
  const mainLinks = visibleLinks(showTeam);
  // The admin links are only shown to allowlisted admins. This is a UI
  // convenience only — the pages and their APIs are gated server-side regardless.
  const adminLinks: NavItem[] = isAdmin
    ? [
        { href: "/dashboard/admin", label: "Admin", icon: BarChart3 },
        {
          href: "/dashboard/admin/cockpit",
          label: "À traiter",
          icon: ListChecks,
          badge: attentionCount,
        },
        { href: "/dashboard/admin/clients", label: "Clients", icon: Building2 },
        {
          href: "/dashboard/admin/prospects",
          label: "Prospection",
          icon: Target,
          badge: prospectsDue,
        },
      ]
    : [];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pagePrimaryInView = usePagePrimaryInView(pathname);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // The pill card's top-up on free credit is a nudge surface: fire the viewed
  // event once per mount so the per-source viewed → clicked ratio is defined
  // for "nav" (same identity as before the redesign).
  const showAddCredit = balance !== null && !balance.funded;
  const navViewed = useRef(false);
  useEffect(() => {
    if (!showAddCredit || navViewed.current) return;
    navViewed.current = true;
    track({
      name: "upgrade_nudge_viewed",
      properties: { source: "nav", level: "offer", reason: "promo_only" },
    });
  }, [showAddCredit]);

  // Make the mobile sheet behave like a modal dialog: Escape closes it, the
  // page behind is scroll-locked, focus moves into the sheet on open and back
  // to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      menuBtnRef.current?.focus();
    };
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  function onTopUpClick() {
    setOpen(false);
    if (!showAddCredit) return;
    track({
      name: "upgrade_cta_clicked",
      properties: { source: "nav", level: "offer", reason: "promo_only" },
    });
  }

  const tone = balance ? balanceTone(balance) : null;

  // Mobile top bar: a compact chip with the balance, linking to Credits.
  const balanceChip =
    balance && tone ? (
      <Link
        href={BILLING_HREF as Route}
        className="inline-flex h-10 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Credit balance: ${eur(balance.totalMicros)}. Open Credits`}
      >
        <span
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold tabular-nums",
            TONE_CHIP[tone]
          )}
        >
          {tone === "danger" && <AlertTriangle aria-hidden className="h-3.5 w-3.5" />}
          {eur(balance.totalMicros)}
        </span>
      </Link>
    ) : null;

  function balanceCard() {
    if (!balance || !tone) return null;
    // The mobile sheet covers the page, so there the pill keeps its rose.
    const topUp = (label: string, primary: boolean) => (
      <Button
        asChild
        size="sm"
        variant={primary && (open || !pagePrimaryInView) ? "default" : "outline"}
        className="mt-3 w-full"
      >
        <Link href={BILLING_HREF as Route} onClick={onTopUpClick}>
          {label}
        </Link>
      </Button>
    );

    if (tone === "promo") {
      const days = daysLeftLabel(balance.promoDaysLeft);
      const extra = balance.totalMicros - balance.promoMicros;
      return (
        <div className={cn("rounded-xl border p-3", TONE_SURFACE.promo)}>
          <p className="text-xs font-semibold text-offer-foreground">Free credit</p>
          <p
            className={cn(
              "mt-1 font-display text-xl font-bold leading-none tabular-nums",
              TONE_FIGURE.promo
            )}
          >
            {eur(balance.promoMicros)}
          </p>
          <p className="mt-1 text-xs text-offer-foreground">
            of {FACTS.signupCredit}
            {days && ` · ${days}`}
          </p>
          {extra > 0 && (
            <p className="text-xs text-offer-foreground">Balance {eur(balance.totalMicros)}</p>
          )}
          <CreditMeter
            className="mt-2"
            share={promoShare(balance.promoMicros, SIGNUP_MICROS)}
            label="Free credit left"
          />
          {topUp("Top up", true)}
        </div>
      );
    }

    if (tone === "neutral") {
      return (
        <div className={cn("rounded-xl border p-3", TONE_SURFACE.neutral)}>
          <p className="text-xs font-medium text-muted-foreground">Balance</p>
          <p
            className={cn(
              "mt-1 font-display text-xl font-bold leading-none tabular-nums",
              TONE_FIGURE.neutral
            )}
          >
            {eur(balance.totalMicros)}
          </p>
          {balance.promoMicros > 0 && balance.promoDaysLeft !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              incl. {eur(balance.promoMicros)} free credit · {daysLeftLabel(balance.promoDaysLeft)}
            </p>
          )}
          {topUp("Top up", false)}
        </div>
      );
    }

    if (tone === "warning") {
      return (
        <div className={cn("rounded-xl border p-3", TONE_SURFACE.warning)}>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
            {balance.reason === "promo_cap" ? "Compute paused" : "Running low"}
          </p>
          <p
            className={cn(
              "mt-1 font-display text-xl font-bold leading-none tabular-nums",
              TONE_FIGURE.warning
            )}
          >
            {eur(balance.totalMicros)}
          </p>
          {topUp("Top up", true)}
        </div>
      );
    }

    return (
      <div className={cn("rounded-xl border p-3", TONE_SURFACE.danger)}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
          {balance.level === "past_due" ? "Payment failed" : "Credit used up"}
        </p>
        <p
          className={cn(
            "mt-1 font-display text-xl font-bold leading-none tabular-nums",
            TONE_FIGURE.danger
          )}
        >
          {eur(balance.totalMicros)}
        </p>
        <p className="mt-1 text-xs text-foreground">
          {balance.level === "past_due"
            ? "Add credit to keep tool calls running."
            : `Calls paused at ${eur(0)}.`}
        </p>
        {topUp("Top up now", true)}
      </div>
    );
  }

  function navLink(item: NavItem) {
    const Icon = item.icon;
    const active =
      pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/dashboard/admin" &&
        pathname?.startsWith(item.href)) ||
      (item.href === "/dashboard/admin" && pathname === "/dashboard/admin");
    return (
      <Link
        key={item.href}
        href={item.href as Route}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-brand/10 font-semibold text-brand"
            : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{item.label}</span>
        {item.badge ? (
          <Badge variant="destructive" className="ml-auto h-5 px-1.5 tabular-nums">
            {item.badge}
          </Badge>
        ) : null}
      </Link>
    );
  }

  function sidebarBody() {
    return (
      <>
        {balanceCard()}
        <div className="mt-5 flex flex-col gap-0.5">{mainLinks.map(navLink)}</div>
        {adminLinks.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="eyebrow mb-2 px-3">Admin</p>
            <div className="flex flex-col gap-0.5">{adminLinks.map(navLink)}</div>
          </div>
        )}
        <div className="mt-auto pt-5">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpen aria-hidden className="h-4 w-4 shrink-0" />
            API docs
          </a>
          {/* Account: email, theme, sign out. */}
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 px-3">
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase text-brand"
              >
                {email.slice(0, 1) || "?"}
              </span>
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
                {email}
              </p>
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start px-3 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile top bar: menu, logo, balance chip. */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-4 lg:hidden">
        <Button
          ref={menuBtnRef}
          variant="ghost"
          size="icon"
          className="-ml-2"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link href={"/dashboard" as Route} className="min-w-0" aria-label="TwinMCP dashboard">
          <Logo mark tagline={false} />
        </Link>
        <div className="ml-auto">{balanceChip}</div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px] dark:bg-background/80"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto border-r border-border bg-card px-3 pb-4 pt-3 shadow-xl duration-200 animate-in slide-in-from-left motion-reduce:animate-none"
          >
            <div className="mb-4 flex h-10 items-center justify-between pl-2">
              <Logo mark tagline={false} />
              <Button
                ref={closeBtnRef}
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {sidebarBody()}
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav
        aria-label="Dashboard"
        className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-3 pb-4 pt-5 lg:sticky lg:top-0 lg:flex lg:h-screen"
      >
        <Link
          href={"/dashboard" as Route}
          className="mb-5 flex h-8 items-center px-2"
          aria-label="TwinMCP dashboard"
        >
          <Logo mark tagline={false} />
        </Link>
        {sidebarBody()}
      </nav>
    </>
  );
}
