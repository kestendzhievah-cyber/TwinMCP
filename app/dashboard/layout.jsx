"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Layout;
// layout.tsx
const react_1 = __importStar(require("react"));
const navigation_1 = require("next/navigation");
const lucide_react_1 = require("lucide-react");
const utils_1 = require("../../lib/utils");
function Layout({ children }) {
    const [isHovered, setIsHovered] = (0, react_1.useState)(false);
    const router = (0, navigation_1.useRouter)();
    const handleNavigation = (path) => {
        router.push(path);
    };
    return (<div className="flex h-screen w-screen bg-[#0a0a0f] text-gray-100 overflow-hidden">
      {/* ===== Sidebar ===== */}
      <aside className={(0, utils_1.cn)("bg-gradient-to-b from-[#1a0b2e] to-[#090311] border-r border-purple-700/30 backdrop-blur-xl relative flex flex-col transition-all duration-300 ease-in-out", isHovered ? "w-64" : "w-16")} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className="p-6 text-center">
          <h1 className={(0, utils_1.cn)("font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400 transition-all duration-300", isHovered ? "text-2xl opacity-100" : "text-lg opacity-70 scale-90")}>
            {isHovered ? "TwinMCP" : "T"}
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem icon={<lucide_react_1.Home size={24}/>} label="Dashboard" active={isHovered} onClick={() => handleNavigation('/dashboard')}/>
          <SidebarItem icon={<lucide_react_1.Users size={24}/>} label="Libraries" active={isHovered} onClick={() => handleNavigation('/dashboard/agent-builder')}/>
          <SidebarItem icon={<lucide_react_1.BarChart3 size={24}/>} label="Docs" active={isHovered} onClick={() => handleNavigation('/dashboard/analytics')}/>
          <SidebarItem icon={<lucide_react_1.Settings size={20}/>} label="Paramètres" active={isHovered} onClick={() => handleNavigation('/dashboard/settings')}/>
        </nav>

        <div className={(0, utils_1.cn)("p-4 text-xs text-gray-500 text-center border-t border-purple-800/20 transition-all duration-300", isHovered ? "opacity-100" : "opacity-50")}>
          {isHovered ? "© 2025 NéoTech" : "©"}
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <div className="flex flex-col flex-1 overflow-hidden">
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

        /* Scrollbar noir pour la sidebar */
        aside::-webkit-scrollbar {
          width: 6px;
        }

        aside::-webkit-scrollbar-track {
          background: transparent;
        }

        aside::-webkit-scrollbar-thumb {
          background: #000000;
          border-radius: 3px;
        }

        aside::-webkit-scrollbar-thumb:hover {
          background: #333333;
        }
      `}</style>
    </div>);
}
function SidebarItem({ icon, label, active, onClick }) {
    return (<button onClick={onClick} className={(0, utils_1.cn)("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_12px_rgba(255,0,255,0.4)]", active
            ? "bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white shadow-[0_0_10px_rgba(255,0,255,0.4)]"
            : "text-gray-400 hover:text-fuchsia-300 hover:bg-purple-800/20")}>
      {icon}
      <span className={(0, utils_1.cn)("text-sm font-medium transition-all duration-300", active ? "opacity-100" : "opacity-0 w-0 overflow-hidden")}>
        {label}
      </span>
    </button>);
}
//# sourceMappingURL=layout.jsx.map