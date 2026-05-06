"use client";

import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BookOpen,
  Boxes,
  Key,
  Library,
  LogOut,
  Settings,
  Shield,
  Store,
  Users,
  CreditCard,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "API Keys", icon: Key },
  { href: "/dashboard/servers", label: "Servers", icon: Boxes },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/libraries", label: "Libraries", icon: Library },
  { href: "/dashboard/policies", label: "Policies", icon: Shield },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="w-60 shrink-0 border-r bg-background flex flex-col px-4 py-6">
      <div className="flex items-center justify-between px-2 mb-6">
        <h2 className="text-lg font-bold tracking-tight">TwinMCP</h2>
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href || (l.href !== "/dashboard" && pathname?.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href as Route}
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
    </nav>
  );
}
