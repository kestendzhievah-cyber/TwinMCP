"use strict";
'use client';
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
exports.default = DocsPage;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const link_1 = __importDefault(require("next/link"));
function DocsPage() {
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const sections = [
        {
            title: 'Introduction',
            icon: <lucide_react_1.Book className="w-5 h-5"/>,
            items: [
                { title: 'Installation', href: '/dashboard/docs/installation', icon: <lucide_react_1.Terminal className="w-4 h-4"/> },
                { title: 'Plans et Tarification', href: '/dashboard/docs/pricing', icon: <lucide_react_1.BarChart className="w-4 h-4"/> },
                { title: 'Propriétaires de Bibliothèques', href: '/dashboard/docs/library-owners', icon: <lucide_react_1.Users className="w-4 h-4"/> },
                { title: 'Guide API', href: '/dashboard/docs/api-guide', icon: <lucide_react_1.Code className="w-4 h-4"/> },
                { title: 'Bonnes Pratiques', href: '/dashboard/docs/best-practices', icon: <lucide_react_1.CheckCircle className="w-4 h-4"/> },
            ]
        },
        {
            title: 'Comment Faire',
            icon: <lucide_react_1.Settings className="w-5 h-5"/>,
            items: [
                { title: 'Gérer les Clés API', href: '/dashboard/docs/api-keys', icon: <lucide_react_1.Key className="w-4 h-4"/> },
                { title: 'Revendiquer Votre Bibliothèque', href: '/dashboard/docs/claim-library', icon: <lucide_react_1.Shield className="w-4 h-4"/> },
                { title: 'Ajouter des Dépôts Privés', href: '/dashboard/docs/private-repos', icon: <lucide_react_1.Lock className="w-4 h-4"/> },
                { title: 'Gérer Votre Équipe', href: '/dashboard/docs/team-management', icon: <lucide_react_1.Users className="w-4 h-4"/> },
                { title: 'Surveiller l\'Utilisation', href: '/dashboard/docs/monitoring', icon: <lucide_react_1.BarChart className="w-4 h-4"/> },
            ]
        },
        {
            title: 'SDKs',
            icon: <lucide_react_1.Code className="w-5 h-5"/>,
            items: [
                { title: 'TypeScript', href: '/dashboard/docs/typescript-sdk', icon: <lucide_react_1.Code className="w-4 h-4"/> },
            ]
        },
        {
            title: 'Référence API',
            icon: <lucide_react_1.Terminal className="w-5 h-5"/>,
            items: [
                { title: 'Recherche', href: '/dashboard/docs/api/search', icon: <lucide_react_1.Search className="w-4 h-4"/> },
                { title: 'Contexte', href: '/dashboard/docs/api/context', icon: <lucide_react_1.Database className="w-4 h-4"/> },
            ]
        },
        {
            title: 'Intégrations',
            icon: <lucide_react_1.Globe className="w-5 h-5"/>,
            items: [
                { title: 'CodeRabbit', href: '/dashboard/docs/integrations/coderabbit', icon: <lucide_react_1.Zap className="w-4 h-4"/> },
            ]
        },
        {
            title: 'Ressources',
            icon: <lucide_react_1.Book className="w-5 h-5"/>,
            items: [
                { title: 'Tous les Clients MCP', href: '/dashboard/docs/clients', icon: <lucide_react_1.Globe className="w-4 h-4"/> },
                { title: 'Guide du Développeur', href: '/dashboard/docs/developer-guide', icon: <lucide_react_1.Code className="w-4 h-4"/> },
                { title: 'Sécurité', href: '/dashboard/docs/security', icon: <lucide_react_1.Shield className="w-4 h-4"/> },
                { title: 'Dépannage', href: '/dashboard/docs/troubleshooting', icon: <lucide_react_1.AlertCircle className="w-4 h-4"/> },
            ]
        },
    ];
    const filteredSections = sections.map(section => ({
        ...section,
        items: section.items.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            section.title.toLowerCase().includes(searchQuery.toLowerCase()))
    })).filter(section => section.items.length > 0);
    return (<div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400">
          Documentation TwinMCP
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Guides complets pour configurer et utiliser votre serveur MCP
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl mx-auto">
        <lucide_react_1.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
        <input type="text" placeholder="Rechercher dans la documentation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#1a1a2e] border border-purple-700/30 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"/>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <lucide_react_1.Zap className="w-6 h-6 text-fuchsia-400"/>
          <h2 className="text-xl font-semibold text-fuchsia-300">Démarrage Rapide</h2>
        </div>
        <p className="text-gray-300 mb-4">
          Nouveau sur TwinMCP ? Commencez par installer votre premier serveur MCP.
        </p>
        <link_1.default href="/dashboard/docs/installation" className="inline-flex items-center gap-2 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg transition-colors">
          Commencer <lucide_react_1.ChevronRight className="w-4 h-4"/>
        </link_1.default>
      </div>

      {/* Documentation Sections */}
      <div className="grid gap-8">
        {filteredSections.map((section, index) => (<div key={index} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
                {section.icon}
              </div>
              <h2 className="text-2xl font-semibold text-gray-100">{section.title}</h2>
            </div>
            
            <div className="grid gap-3">
              {section.items.map((item, itemIndex) => (<link_1.default key={itemIndex} href={item.href} className="flex items-center gap-4 p-4 bg-[#1a1a2e] border border-purple-700/30 rounded-lg hover:border-fuchsia-500/50 hover:bg-[#252542] transition-all group">
                  <div className="p-2 bg-purple-600/10 rounded-lg text-purple-400 group-hover:text-fuchsia-400 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-gray-100 font-medium group-hover:text-fuchsia-300 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <lucide_react_1.ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-fuchsia-400 transition-colors"/>
                </link_1.default>))}
            </div>
          </div>))}
      </div>

      {/* Help Section */}
      <div className="text-center space-y-4 pt-8 border-t border-purple-700/30">
        <h3 className="text-xl font-semibold text-gray-100">Besoin d'aide ?</h3>
        <p className="text-gray-400">
          Notre équipe est là pour vous aider à configurer votre serveur MCP.
        </p>
        <div className="flex justify-center gap-4">
          <link_1.default href="/dashboard/docs/troubleshooting" className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
            Centre d'aide
          </link_1.default>
          <link_1.default href="/dashboard/docs/api-guide" className="px-6 py-3 border border-purple-600 hover:bg-purple-600/20 text-purple-400 rounded-lg transition-colors">
            Documentation API
          </link_1.default>
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map