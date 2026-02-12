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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardNavigation = DashboardNavigation;
const react_1 = __importStar(require("react"));
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const lucide_react_1 = require("lucide-react");
function DashboardNavigation() {
    const router = (0, navigation_1.useRouter)();
    const pathname = (0, navigation_1.usePathname)();
    const [mobileMenuOpen, setMobileMenuOpen] = (0, react_1.useState)(false);
    const navigation = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: lucide_react_1.Home,
            href: '/dashboard',
            description: 'Vue d\'ensemble'
        },
        {
            id: 'api-keys',
            label: 'Clés API',
            icon: lucide_react_1.Key,
            href: '/dashboard/api-keys',
            badge: 2, // Nombre de clés (à dynamiser)
            description: 'Gérer vos clés d\'accès API'
        },
        {
            id: 'libraries',
            label: 'Bibliothèques',
            icon: lucide_react_1.Code,
            href: '/dashboard/libraries',
            description: 'Catalogue des bibliothèques'
        },
        {
            id: 'usage',
            label: 'Utilisation',
            icon: lucide_react_1.BarChart3,
            href: '/dashboard/usage',
            description: 'Statistiques d\'utilisation'
        },
        {
            id: 'members',
            label: 'Membres',
            icon: lucide_react_1.Users,
            href: '/dashboard/members',
            description: 'Gestion des membres'
        },
        {
            id: 'rules',
            label: 'Règles',
            icon: lucide_react_1.Terminal,
            href: '/dashboard/rules',
            description: 'Configuration des règles'
        },
        {
            id: 'docs',
            label: 'Documentation',
            icon: lucide_react_1.FileText,
            href: '/dashboard/docs',
            description: 'Documentation API'
        },
        {
            id: 'settings',
            label: 'Paramètres',
            icon: lucide_react_1.Settings,
            href: '/dashboard/settings',
            description: 'Paramètres du compte'
        }
    ];
    const isActive = (href) => {
        if (href === pathname)
            return true;
        // Gérer les sous-routes
        if (pathname.startsWith(href) && href !== '/')
            return true;
        return false;
    };
    return (<nav className="bg-gradient-to-r from-[#1a1b2e] via-[#1a0b2e] to-[#0f0520] border-b border-purple-500/20 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/30">
              <lucide_react_1.Zap className="w-6 h-6 text-white"/>
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
            return (<link_1.default key={item.id} href={item.href} className={`
                    relative group flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${active
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-purple-900/30'}
                  `} title={item.description}>
                  <Icon className="w-4 h-4"/>
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.badge && (<span className={`
                      absolute -top-1 -right-1 px-2 py-0.5 text-xs rounded-full
                      ${active
                        ? 'bg-white text-purple-600'
                        : 'bg-purple-500 text-white'}
                    `}>
                      {item.badge}
                    </span>)}
                </link_1.default>);
        })}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-400 hover:text-white transition-colors">
            <div className="space-y-1">
              <div className="w-6 h-0.5 bg-gray-400"></div>
              <div className="w-6 h-0.5 bg-gray-400"></div>
              <div className="w-6 h-0.5 bg-gray-400"></div>
            </div>
          </button>

          {/* User menu */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <lucide_react_1.Shield className="w-5 h-5"/>
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <lucide_react_1.Settings className="w-5 h-5"/>
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <lucide_react_1.LogOut className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (<div className="md:hidden absolute top-full left-0 right-0 bg-[#1a1b2e] border-b border-purple-500/20 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold text-white">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white transition-colors">
                  <div className="w-6 h-0.5 bg-gray-400"></div>
                  <div className="w-6 h-0.5 bg-gray-400"></div>
                  <div className="w-6 h-0.5 bg-gray-400"></div>
                </button>
              </div>
              
              <div className="space-y-2">
                {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (<link_1.default key={item.id} href={item.href} onClick={() => setMobileMenuOpen(false)} className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                        ${active
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-purple-900/30'}
                      `}>
                      <Icon className="w-5 h-5"/>
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.description}</div>
                      </div>
                      {item.badge && (<span className={`
                          px-2 py-0.5 text-xs rounded-full
                          ${active
                            ? 'bg-white text-purple-600'
                            : 'bg-purple-500 text-white'}
                        `}>
                          {item.badge}
                        </span>)}
                    </link_1.default>);
            })}
              </div>
            </div>
          </div>)}
      </div>
    </nav>);
}
//# sourceMappingURL=dashboard-navigation.jsx.map