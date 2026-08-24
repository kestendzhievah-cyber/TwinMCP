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
import type { Plan } from "@/db/schema/core";
import { PLAN_LABELS } from "@/lib/plan-features";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Key,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Store,
  Upload,
  Users,
  CreditCard,
  X,
} from "lucide-react";

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

export function DashboardNav({
  email,
  plan,
  isAdmin = false,
}: {
  email: string;
  plan: Plan;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  // The Admin analytics link is only shown to allowlisted admins. This is a UI
  // convenience only — the page and its API are gated server-side regardless.
  const navLinks = isAdmin
    ? [...links, { href: "/dashboard/admin", label: "Admin", icon: BarChart3 }]
    : links;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

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
      <Badge variant={plan === "free" ? "secondary" : "success"}>{PLAN_LABELS[plan]} plan</Badge>
    </Link>
  );

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
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
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
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors mb-2"
        >
          <BookOpen className="h-4 w-4" />
          API Docs
        </a>
        <Separator className="mb-3" />
        <p className="text-xs text-muted-foreground mb-2 break-all px-2">{email}</p>
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
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight">TwinMCP</h2>
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
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r bg-background px-4 py-6"
          >
            <div className="mb-6 flex items-center justify-between px-2">
              <h2 className="text-lg font-bold tracking-tight">TwinMCP</h2>
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
            <div className="mb-6 px-2">{planBadge}</div>
            <NavLinks />
            <NavFooter />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden w-60 shrink-0 flex-col border-r bg-background px-4 py-6 md:flex">
        <div className="mb-4 flex items-center justify-between px-2">
          <h2 className="text-lg font-bold tracking-tight">TwinMCP</h2>
          <ThemeToggle />
        </div>
        <div className="mb-6 px-2">{planBadge}</div>
        <NavLinks />
        <NavFooter />
      </nav>
    </>
  );
}
