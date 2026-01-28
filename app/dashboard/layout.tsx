"use client";

// layout.tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, Users, BarChart3, Settings, Loader2, Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../lib/auth-context";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();

  // Rediriger vers login si non authentifié
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  // Afficher un loader pendant la vérification de l'authentification
  if (loading) {
    return (
      <div className="flex h-screen w-screen bg-[#0a0a0f] items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Ne pas afficher le dashboard si non connecté
  if (!user) {
    return (
      <div className="flex h-screen w-screen bg-[#0a0a0f] items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* ===== Mobile Menu Button ===== */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-lg shadow-lg hover:shadow-purple-500/50 transition-all"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* ===== Mobile Overlay ===== */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={cn(
          "bg-gradient-to-b from-[#1a0b2e] to-[#090311] border-r border-purple-700/30 backdrop-blur-xl relative flex flex-col transition-all duration-300 ease-in-out",
          "lg:relative fixed inset-y-0 left-0 z-40",
          isHovered ? "w-64" : "w-16",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="p-6 text-center">
          <h1 className={cn(
            "font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400 transition-all duration-300",
            isHovered ? "text-2xl opacity-100" : "text-lg opacity-70 scale-90"
          )}>
            {isHovered ? "TwinMCP" : "T"}
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem
            icon={<Home size={24} />}
            label="Dashboard"
            active={isHovered}
            onClick={() => handleNavigation('/dashboard')}
          />
          <SidebarItem
            icon={<Users size={24} />}
            label="Libraries"
            active={isHovered}
            onClick={() => handleNavigation('/dashboard/agent-builder')}
          />
          <SidebarItem
            icon={<BarChart3 size={24} />}
            label="Docs"
            active={isHovered}
            onClick={() => handleNavigation('/dashboard/analytics')}
          />
          <SidebarItem
            icon={<Settings size={20} />}
            label="Paramètres"
            active={isHovered}
            onClick={() => handleNavigation('/dashboard/settings')}
          />
        </nav>

        <div className={cn(
          "p-4 text-xs text-gray-500 text-center border-t border-purple-800/20 transition-all duration-300",
          isHovered ? "opacity-100" : "opacity-50"
        )}>
          {isHovered ? "© 2025 NéoTech" : "©"}
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <div className="flex flex-col flex-1 overflow-hidden w-full">
        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#0d0d17] to-[#1a0b2e]">
          <div className="animate-fade-in max-w-full">
            {children}
          </div>
        </main>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        /* Scrollbar optimisée pour la sidebar */
        aside::-webkit-scrollbar {
          width: 8px;
        }

        aside::-webkit-scrollbar-track {
          background: rgba(16, 7, 30, 0.3);
          border-radius: 10px;
          margin: 4px 0;
        }

        aside::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #a855f7 0%, #7c3aed 100%);
          border-radius: 10px;
          border: 2px solid rgba(16, 7, 30, 0.3);
          transition: all 0.3s ease;
        }

        aside::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #c084fc 0%, #9333ea 100%);
          border-color: rgba(16, 7, 30, 0.5);
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }

        /* Scrollbar optimisée pour le contenu principal */
        main::-webkit-scrollbar {
          width: 10px;
        }

        main::-webkit-scrollbar-track {
          background: rgba(16, 7, 30, 0.2);
          border-radius: 10px;
          margin: 8px 0;
        }

        main::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #d946ef 0%, #a855f7 50%, #7c3aed 100%);
          border-radius: 10px;
          border: 2px solid rgba(13, 13, 23, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        main::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #e879f9 0%, #c084fc 50%, #9333ea 100%);
          border-color: rgba(13, 13, 23, 0.6);
          box-shadow: 0 0 15px rgba(217, 70, 239, 0.6);
          transform: scaleX(1.1);
        }

        main::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg, #f0abfc 0%, #d946ef 50%, #a855f7 100%);
          box-shadow: 0 0 20px rgba(217, 70, 239, 0.8);
        }

        /* Amélioration du scroll pour Firefox */
        aside, main {
          scrollbar-width: thin;
          scrollbar-color: #a855f7 rgba(16, 7, 30, 0.3);
        }

        /* Smooth scroll behavior */
        main {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_12px_rgba(255,0,255,0.4)]",
        active
          ? "bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white shadow-[0_0_10px_rgba(255,0,255,0.4)]"
          : "text-gray-400 hover:text-fuchsia-300 hover:bg-purple-800/20"
      )}
    >
      {icon}
      <span className={cn(
        "text-sm font-medium transition-all duration-300",
        active ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
      )}>
        {label}
      </span>
    </button>
  );
}
