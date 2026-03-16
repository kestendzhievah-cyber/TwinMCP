'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Bot,
  FileJson,
  Home,
  Menu,
  Package,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Vue d\'ensemble', icon: Home },
  { href: '/dashboard/products', label: 'Produits', icon: Package },
  { href: '/dashboard/analyzer', label: 'Analyseur LLM', icon: Sparkles },
  { href: '/dashboard/ucp-contexts', label: 'Contextes UCP', icon: FileJson },
  { href: '/dashboard/optimizer', label: 'Optimiseur', icon: Bot },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/stores', label: 'Boutiques', icon: Store },
  { href: '/dashboard/settings', label: 'Paramètres', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b border-white/5 bg-background/80 backdrop-blur-xl px-4 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-bg">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-sm">UCP Commerce</span>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-background border-r border-white/5 p-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold">UCP Commerce</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    pathname === item.href
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/5 bg-background">
          <div className="flex h-16 items-center gap-2 px-6 border-b border-white/5">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">UCP Commerce</span>
            </Link>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
                  pathname === item.href
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-sm shadow-violet-500/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5">
            <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-medium">Plan Starter</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                50 produits analysés. Passez au Pro pour débloquer tout.
              </p>
              <Link href="/dashboard/settings">
                <button className="w-full rounded-lg gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                  Upgrade Pro
                </button>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
