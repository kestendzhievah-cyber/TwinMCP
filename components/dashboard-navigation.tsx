"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  Settings, 
  Key, 
  BarChart3, 
  Users, 
  Package, 
  FileText, 
  Shield, 
  LogOut,
  Home,
  BookOpen,
  Code,
  Zap,
  Terminal
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  href: string;
  badge?: number;
  description?: string;
}

export function DashboardNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      href: '/dashboard',
      description: 'Vue d\'ensemble'
    },
    {
      id: 'api-keys',
      label: 'Clés API',
      icon: Key,
      href: '/dashboard/api-keys',
      badge: 2, // Nombre de clés (à dynamiser)
      description: 'Gérer vos clés d\'accès API'
    },
    {
      id: 'libraries',
      label: 'Bibliothèques',
      icon: Code,
      href: '/dashboard/libraries',
      description: 'Catalogue des bibliothèques'
    },
    {
      id: 'usage',
      label: 'Utilisation',
      icon: BarChart3,
      href: '/dashboard/usage',
      description: 'Statistiques d\'utilisation'
    },
    {
      id: 'members',
      label: 'Membres',
      icon: Users,
      href: '/dashboard/members',
      description: 'Gestion des membres'
    },
    {
      id: 'rules',
      label: 'Règles',
      icon: Terminal,
      href: '/dashboard/rules',
      description: 'Configuration des règles'
    },
    {
      id: 'docs',
      label: 'Documentation',
      icon: FileText,
      href: '/dashboard/docs',
      description: 'Documentation API'
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
      href: '/dashboard/settings',
      description: 'Paramètres du compte'
    }
  ];

  const isActive = (href: string) => {
    if (href === pathname) return true;
    // Gérer les sous-routes
    if (pathname.startsWith(href) && href !== '/') return true;
    return false;
  };

  return (
    <nav className="bg-gradient-to-r from-[#1a1b2e] via-[#1a0b2e] to-[#0f0520] border-b border-purple-500/20 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/30">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                TwinMCP
              </span>
              <p className="text-xs text-gray-400">Plateforme MCP de Documentation</p>
            </div>
          </div>

          {/* Navigation Desktop */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`
                    relative group flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${active 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30' 
                      : 'text-gray-300 hover:text-white hover:bg-purple-900/30'
                    }
                  `}
                  title={item.description}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.badge && (
                    <span className={`
                      absolute -top-1 -right-1 px-2 py-0.5 text-xs rounded-full
                      ${active 
                        ? 'bg-white text-purple-600' 
                        : 'bg-purple-500 text-white'
                      }
                    `}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            <div className="space-y-1">
              <div className="w-6 h-0.5 bg-gray-400"></div>
              <div className="w-6 h-0.5 bg-gray-400"></div>
              <div className="w-6 h-0.5 bg-gray-400"></div>
            </div>
          </button>

          {/* User menu */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Shield className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#1a1b2e] border-b border-purple-500/20 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold text-white">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <div className="w-6 h-0.5 bg-gray-400"></div>
                  <div className="w-6 h-0.5 bg-gray-400"></div>
                  <div className="w-6 h-0.5 bg-gray-400"></div>
                </button>
              </div>
              
              <div className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                        ${active 
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-purple-900/30'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.description}</div>
                      </div>
                      {item.badge && (
                        <span className={`
                          px-2 py-0.5 text-xs rounded-full
                          ${active 
                            ? 'bg-white text-purple-600' 
                            : 'bg-purple-500 text-white'
                          }
                        `}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
