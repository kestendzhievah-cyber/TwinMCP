"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import {
  Sparkles,
  LayoutDashboard,
  Key,
  Library,
  FileText,
  Settings,
  BarChart3,
  CreditCard,
  Server,
  BookOpen,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  LogOut,
  Zap,
  Search,
  Plus,
  MessageSquare,
  Globe,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

type DashboardTheme = "light" | "dark" | "twinmcp";

function NavLink({ item, collapsed = false, pathname }: { item: NavItem; collapsed?: boolean; pathname: string }) {
  const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
        ${isActive 
          ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30" 
          : "text-gray-400 hover:text-white hover:bg-white/5"
        }
        ${collapsed ? "justify-center" : ""}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-purple-400" : "group-hover:text-purple-400"}`} />
      {!collapsed && (
        <>
          <span className="font-medium text-sm">{item.name}</span>
          {item.badge && (
            <span className={`ml-auto px-2 py-0.5 text-xs font-semibold rounded-full text-white ${item.badgeColor || "bg-purple-500"}`}>
              {item.badge}
            </span>
          )}
        </>
      )}
      {collapsed && item.badge && (
        <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${item.badgeColor || "bg-purple-500"}`} />
      )}
    </Link>
  );
}

const mainNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bibliothèques", href: "/dashboard/library", icon: Library },
  { name: "Ajouter", href: "/dashboard/agent-builder", icon: Plus, badge: "New", badgeColor: "bg-pink-500" },
  { name: "Clés API", href: "/dashboard/api-keys", icon: Key },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Serveur MCP", href: "/dashboard/mcp-guide", icon: Server, badge: "Live", badgeColor: "bg-green-500" },
  { name: "MCP Externes", href: "/dashboard/external-mcp", icon: Globe },
];

const secondaryNavItems: NavItem[] = [
  { name: "Documentation", href: "/dashboard/docs", icon: BookOpen },
  { name: "Paramètres", href: "/dashboard/settings", icon: Settings },
  { name: "Facturation", href: "/dashboard/invoices", icon: CreditCard },
  { name: "Aide", href: "/dashboard/docs/troubleshooting", icon: HelpCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>("twinmcp");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const userEmail = profile?.email || user?.email || '';
  const userName = profile?.name || user?.displayName || 'Utilisateur';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync dashboard theme with settings page
  useEffect(() => {
    const applySavedTheme = () => {
      try {
        const saved = localStorage.getItem("twinmcp_dashboard_theme") as DashboardTheme | null;
        if (saved === "light" || saved === "dark" || saved === "twinmcp") {
          setDashboardTheme(saved);
        } else {
          setDashboardTheme("twinmcp");
        }
      } catch {
        setDashboardTheme("twinmcp");
      }
    };

    applySavedTheme();

    const onThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme?: DashboardTheme }>;
      const nextTheme = customEvent.detail?.theme;
      if (nextTheme === "light" || nextTheme === "dark" || nextTheme === "twinmcp") {
        setDashboardTheme(nextTheme);
      } else {
        applySavedTheme();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "twinmcp_dashboard_theme") {
        applySavedTheme();
      }
    };

    window.addEventListener("twinmcp-dashboard-theme-change", onThemeChange as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("twinmcp-dashboard-theme-change", onThemeChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const themeClasses = {
    root:
      dashboardTheme === "light"
        ? "min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white"
        : dashboardTheme === "dark"
        ? "min-h-screen bg-gradient-to-br from-[#080808] via-[#121212] to-[#090909]"
        : "min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520]",
    surface:
      dashboardTheme === "light"
        ? "bg-white/95 border-slate-200"
        : dashboardTheme === "dark"
        ? "bg-[#121212]/95 border-white/10"
        : "bg-[#0f0520]/95 border-purple-500/20",
    panel:
      dashboardTheme === "light"
        ? "bg-white border-slate-200"
        : dashboardTheme === "dark"
        ? "bg-[#1a1a1a] border-white/10"
        : "bg-[#1a1b2e] border-purple-500/20",
  };

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // All searchable items
  const allSearchableItems = useMemo(() => [
    ...mainNavItems.map(item => ({ ...item, section: 'Navigation' })),
    ...secondaryNavItems.map(item => ({ ...item, section: 'Navigation' })),
  ], []);

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allSearchableItems.filter(item =>
      item.name.toLowerCase().includes(q)
    );
  }, [searchQuery, allSearchableItems]);

  return (
    <div className={themeClasses.root} data-dashboard-theme={dashboardTheme}>
      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]" onClick={() => setSearchOpen(false)}>
          <div className={`w-full max-w-2xl ${themeClasses.panel} border rounded-2xl shadow-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-purple-500/20">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher bibliothèques, outils, documentation..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Rechercher dans le dashboard"
              />
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">ESC</kbd>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {searchQuery ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Résultats ({filteredSearchResults.length})</p>
                  {filteredSearchResults.length > 0 ? (
                    filteredSearchResults.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-500/10 transition"
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                      >
                        <item.icon className="w-5 h-5 text-purple-400" />
                        <div>
                          <p className="text-white font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.section}</p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucun résultat pour "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Navigation rapide</p>
                    <div className="grid grid-cols-2 gap-2">
                      {mainNavItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-2 p-3 rounded-lg hover:bg-purple-500/10 transition text-gray-300 hover:text-white"
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        >
                          <item.icon className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Actions</p>
                    <div className="flex gap-2">
                      <Link href="/dashboard/agent-builder" className="flex-1 flex items-center justify-center gap-2 p-3 bg-purple-500/20 rounded-lg text-purple-400 hover:bg-purple-500/30 transition" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Ajouter docs</span>
                      </Link>
                      <Link href="/chat" className="flex-1 flex items-center justify-center gap-2 p-3 bg-pink-500/20 rounded-lg text-pink-400 hover:bg-pink-500/30 transition" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm font-medium">Chat</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className={`fixed inset-y-0 left-0 w-72 ${themeClasses.surface} border-r p-4 overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">TwinMCP</span>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="space-y-1">
              {mainNavItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
            <div className="my-6 border-t border-purple-500/20" />
            <nav className="space-y-1">
              {secondaryNavItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col ${themeClasses.surface} backdrop-blur-xl border-r transition-all duration-300 ${sidebarOpen ? "w-64" : "w-20"}`}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-purple-500/20 ${sidebarOpen ? "justify-between" : "justify-center"}`}>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && <span className="text-xl font-bold text-white">TwinMCP</span>}
          </Link>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={!sidebarOpen} pathname={pathname} />
          ))}
          
          <div className="my-4 border-t border-purple-500/20" />
          
          {secondaryNavItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={!sidebarOpen} pathname={pathname} />
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-purple-500/20">
          {sidebarOpen ? (
            <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="font-semibold text-white text-sm">Plan Pro</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">Débloquez toutes les fonctionnalités</p>
              <Link href="/pricing" className="block w-full py-2 text-center text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                Upgrader
              </Link>
            </div>
          ) : (
            <button onClick={() => setSidebarOpen(true)} className="w-full p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition flex justify-center">
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className={`min-h-screen transition-all duration-300 ${sidebarOpen ? "lg:pl-64" : "lg:pl-20"}`}>
        {/* Top Header */}
        <header className={`sticky top-0 z-20 h-16 ${themeClasses.surface} backdrop-blur-xl border-b`}>
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Mobile Menu Button */}
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-gray-400 hover:text-white">
              <Menu className="w-6 h-6" />
            </button>

            {/* Search Bar */}
            <button
              onClick={() => setSearchOpen(true)}
              className={`flex items-center gap-3 px-4 py-2 ${themeClasses.panel} border rounded-xl text-gray-400 hover:border-purple-500/40 transition w-full max-w-md mx-4 lg:mx-0`}
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Rechercher...</span>
              <kbd className="ml-auto px-2 py-0.5 bg-gray-800 rounded text-xs hidden sm:block">⌘K</kbd>
            </button>

            {/* Right Actions */}
            <div className="flex items-center gap-2 lg:gap-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition" aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </button>

              {/* External Link */}
              <Link href="/" target="_blank" className="hidden lg:flex p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                <Globe className="w-5 h-5" />
              </Link>

              {/* User Menu */}
              <div className="relative group">
                <button className="flex items-center gap-2 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                    {userInitials}
                  </div>
                  <ChevronRight className="w-4 h-4 hidden lg:block rotate-90" />
                </button>
                
                {/* Dropdown */}
                <div className={`absolute right-0 top-full mt-2 w-56 ${themeClasses.panel} border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200`}>
                  <div className="p-4 border-b border-purple-500/20">
                    <p className="font-medium text-white">{userName}</p>
                    <p className="text-sm text-gray-400 truncate">{userEmail}</p>
                  </div>
                  <div className="p-2">
                    <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Paramètres</span>
                    </Link>
                    <Link href="/dashboard/api-keys" className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                      <Key className="w-4 h-4" />
                      <span className="text-sm">Clés API</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Déconnexion</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <DashboardErrorBoundary>
            {children}
          </DashboardErrorBoundary>
        </main>
      </div>
    </div>
  );
}
