"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/marketing/logo";
import type { Plan } from "@/db/schema/core";
import { PLAN_LABELS } from "@/lib/plan-features";
import { BILLING_HREF } from "@/lib/billing/upgrade-state";
import { track } from "@/lib/analytics/funnel";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ListChecks,
  Key,
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

const links = [
  { href: "/dashboard", label: "Overview", icon: Key },
  { href: "/dashboard/servers", label: "Servers", icon: Boxes },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/mcps", label: "Publish MCP", icon: Upload },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/usage", label: "Usage", icon: Activity },
  { href: "/dashboard/audit-logs", label: "Audit logs", icon: ScrollText },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Team workspaces are no longer sold. The Team link follows the same rule as
// app/dashboard/team/page.tsx: grandfathered Team subscribers, plus users who
// already belong to a teamspace (e.g. invited by a Team subscriber). The layout
// knows the membership and passes `showTeam`; without it, only the plan counts.
function visibleLinks(showTeam: boolean) {
  return showTeam ? links : links.filter((l) => l.href !== "/dashboard/team");
}

export function DashboardNav({
  email,
  plan,
  isAdmin = false,
  prospectsDue = 0,
  attentionCount = 0,
  showTeam = plan === "team",
  trialEligible = false,
}: {
  email: string;
  plan: Plan;
  isAdmin?: boolean;
  prospectsDue?: number;
  attentionCount?: number;
  /** Team plan OR an existing teamspace membership (computed by the layout). */
  showTeam?: boolean;
  /** Free account with no Stripe customer yet: the first month of Pro is free. */
  trialEligible?: boolean;
}) {
  const pathname = usePathname();
  const planLinks = visibleLinks(showTeam);
  // The Admin analytics link is only shown to allowlisted admins. This is a UI
  // convenience only — the page and its API are gated server-side regardless.
  const navLinks: NavItem[] = isAdmin
    ? [
        ...planLinks,
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
    : planLinks;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // The nav link is a nudge surface too: fire the viewed event once per mount
  // so the per-source viewed → clicked ratio is defined for "nav".
  const navViewed = useRef(false);
  useEffect(() => {
    if (plan !== "free" || navViewed.current) return;
    navViewed.current = true;
    track({
      name: "upgrade_nudge_viewed",
      properties: { source: "nav", level: "offer", reason: "offer" },
    });
  }, [plan]);

  // Make the mobile drawer behave like a modal dialog: Escape closes it, the
  // page behind is scroll-locked, focus moves into the drawer on open and back
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

  const planBadge = (
    <Link href={"/dashboard/billing" as Route} aria-label={`Current plan: ${PLAN_LABELS[plan]}`}>
      <Badge variant={plan === "free" ? "secondary" : plan === "pro" ? "success" : "gilt"}>
        {PLAN_LABELS[plan]} plan
      </Badge>
    </Link>
  );

  // Free accounts: one small-caps link under the plan badge (sidebar and
  // drawer; the mobile top bar stays one row), trial-aware. The label is the
  // only thing that changes; the decision lives in the layout.
  const upgradeLink =
    plan === "free" ? (
      <Link
        href={BILLING_HREF as Route}
        onClick={() => {
          setOpen(false);
          track({
            name: "upgrade_cta_clicked",
            properties: { source: "nav", level: "offer", reason: "offer" },
          });
        }}
        className="smallcaps tracking-sc whitespace-nowrap text-xs text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
      >
        {trialEligible ? "Start free month" : "Upgrade to Pro"}
      </Link>
    ) : null;

  function NavLinks() {
    return (
      <div className="flex flex-col gap-1">
        {navLinks.map((l) => {
          const Icon = l.icon;
          const active =
            pathname === l.href || (l.href !== "/dashboard" && pathname?.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href as Route}
              onClick={() => setOpen(false)}
              className={cn(
                "smallcaps tracking-sc flex items-center gap-2.5 border-l-2 py-2 pl-3 pr-2 text-sm transition-colors",
                active
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
              {l.badge ? (
                <Badge variant="destructive" className="lining ml-auto h-5 px-1.5">
                  {l.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </div>
    );
  }

  function NavFooter() {
    return (
      <div className="mt-auto pt-4">
        <Separator className="mb-3" />
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="smallcaps tracking-sc mb-2 flex items-center gap-2.5 border-l-2 border-transparent py-2 pl-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <BookOpen className="h-4 w-4" />
          API Docs
        </a>
        <Separator className="mb-3" />
        <p className="mb-2 break-all px-3 text-xs italic text-muted-foreground">{email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Logo tagline="Control Plane" />
          {planBadge}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            ref={menuBtnRef}
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-foreground/30"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col border-r border-border bg-background px-4 py-6"
          >
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo tagline="Control Plane" />
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
            <div className="mb-6 flex flex-col items-start gap-2 border-b border-border px-2 pb-6">
              {planBadge}
              {upgradeLink}
            </div>
            <NavLinks />
            <NavFooter />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden w-64 shrink-0 flex-col border-r border-border bg-background px-4 py-6 md:flex">
        <div className="mb-5 flex items-start justify-between px-2">
          <Logo tagline="Control Plane" />
          <ThemeToggle />
        </div>
        <div className="rule-double mb-6 flex flex-col items-start gap-2 px-2 pt-5">
          {planBadge}
          {upgradeLink}
        </div>
        <NavLinks />
        <NavFooter />
      </nav>
    </>
  );
}
