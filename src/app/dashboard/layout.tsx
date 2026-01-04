"use client";

// layout.tsx
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Users, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* ===== Sidebar ===== */}
      <aside
        className={cn(
          "bg-gradient-to-b from-[#1a0b2e] to-[#090311] border-r border-purple-700/30 backdrop-blur-xl relative flex flex-col transition-all duration-300 ease-in-out",
          isHovered ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="p-6 text-center">
          <h1 className={cn(
            "font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400 transition-all duration-300",
            isHovered ? "text-2xl opacity-100" : "text-lg opacity-70 scale-90"
          )}>
            {isHovered ? "Corel.IA" : "C"}
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem
            icon={<Home size={20} />}
            label="Accueil"
            active={isHovered}
            onClick={() => handleNavigation('/dashboard')}
          />
          <SidebarItem
            icon={<Users size={20} />}
            label="Agents"
            active={isHovered}
            onClick={() => handleNavigation('/dashboard/agent-builder')}
          />
          <SidebarItem
            icon={<BarChart3 size={20} />}
            label="Statistiques"
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
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-6 border-b border-purple-700/30 bg-[#0e0e16]/70 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-purple-300 tracking-wide">
            Tableau de bord
          </h2>
          <div className="flex items-center gap-4">
            <div className="h-3 w-3 bg-fuchsia-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">En ligne</span>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-[#0d0d17] to-[#1a0b2e]">
          <div className="animate-fade-in">
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
