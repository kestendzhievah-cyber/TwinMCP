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
exports.default = SettingsPage;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils");
function SettingsPage() {
    const [activeTab, setActiveTab] = (0, react_1.useState)("profile");
    const [showApiKey, setShowApiKey] = (0, react_1.useState)(false);
    const [copiedKey, setCopiedKey] = (0, react_1.useState)(false);
    const tabs = [
        { id: "profile", label: "Profil", icon: lucide_react_1.User },
        { id: "security", label: "Sécurité", icon: lucide_react_1.Shield },
        { id: "notifications", label: "Notifications", icon: lucide_react_1.Bell },
        { id: "appearance", label: "Apparence", icon: lucide_react_1.Palette },
        { id: "integrations", label: "Intégrations", icon: lucide_react_1.Database },
        { id: "api", label: "API", icon: lucide_react_1.Key }
    ];
    const generateApiKey = () => {
        return "sk-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy: ', err);
        }
    };
    return (<div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d17] to-[#1a0b2e] text-white">
      {/* Navigation Header */}
      <nav className="border-b border-purple-700/30 bg-[#0e0e16]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#8b5cf6]/40 to-[#ef4d95]/25 border border-[#8b5cf6]/30" style={{ boxShadow: "0 6px 30px rgba(139,92,246,0.18)" }}>
                <lucide_react_1.Settings className="w-5 h-5 text-[#ef4d95]"/>
              </div>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400">
                Paramètres Corel.IA
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                <lucide_react_1.Save className="w-4 h-4 mr-2 inline"/>
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[rgba(255,255,255,0.02)] border border-white/6 rounded-xl p-4 backdrop-blur">
              <nav className="space-y-2">
                {tabs.map((tab) => {
            const Icon = tab.icon;
            return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={(0, utils_1.cn)("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200", activeTab === tab.id
                    ? "bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white shadow-[0_0_10px_rgba(255,0,255,0.4)]"
                    : "text-gray-400 hover:text-fuchsia-300 hover:bg-purple-800/20")}>
                      <Icon size={18}/>
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>);
        })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-[rgba(255,255,255,0.02)] border border-white/6 rounded-xl p-6 backdrop-blur">
              {activeTab === "profile" && (<div>
                  <h2 className="text-2xl font-bold mb-6">Informations du Profil</h2>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nom complet</label>
                        <input type="text" defaultValue="John Doe" className="w-full px-4 py-3 bg-white/6 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"/>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                        <input type="email" defaultValue="john@corelia.com" className="w-full px-4 py-3 bg-white/6 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Entreprise</label>
                      <input type="text" defaultValue="Corel.IA" className="w-full px-4 py-3 bg-white/6 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                      <textarea rows={4} defaultValue="Développeur passionné par l'IA et les nouvelles technologies." className="w-full px-4 py-3 bg-white/6 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition resize-none"/>
                    </div>
                  </div>
                </div>)}

              {activeTab === "security" && (<div>
                  <h2 className="text-2xl font-bold mb-6">Sécurité & Confidentialité</h2>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/6">
                      <div>
                        <h3 className="font-semibold">Authentification à deux facteurs</h3>
                        <p className="text-sm text-gray-400">Ajoutez une couche de sécurité supplémentaire</p>
                      </div>
                      <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                        Activer
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/6">
                      <div>
                        <h3 className="font-semibold">Sessions actives</h3>
                        <p className="text-sm text-gray-400">Gérez vos sessions connectées</p>
                      </div>
                      <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition">
                        Voir les sessions
                      </button>
                    </div>
                    <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <lucide_react_1.Trash2 className="w-5 h-5 text-red-400"/>
                        <h3 className="font-semibold text-red-400">Zone de danger</h3>
                      </div>
                      <p className="text-sm text-gray-300 mb-4">
                        Supprimez définitivement votre compte et toutes vos données.
                      </p>
                      <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
                        Supprimer le compte
                      </button>
                    </div>
                  </div>
                </div>)}

              {activeTab === "notifications" && (<div>
                  <h2 className="text-2xl font-bold mb-6">Préférences de Notifications</h2>
                  <div className="space-y-4">
                    {[
                { title: "Nouveaux messages", description: "Recevoir des notifications pour les nouveaux messages" },
                { title: "Rapports hebdomadaires", description: "Résumé de l'activité de vos agents" },
                { title: "Alertes de sécurité", description: "Notifications importantes pour la sécurité" },
                { title: "Mises à jour produit", description: "Informations sur les nouvelles fonctionnalités" }
            ].map((item, index) => (<div key={index} className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/6">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="text-sm text-gray-400">{item.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked/>
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>))}
                  </div>
                </div>)}

              {activeTab === "appearance" && (<div>
                  <h2 className="text-2xl font-bold mb-6">Apparence & Interface</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Thème</label>
                      <div className="grid grid-cols-3 gap-3">
                        {["Clair", "Sombre", "Néons"].map((theme) => (<button key={theme} className={(0, utils_1.cn)("p-3 rounded-lg border transition-all", theme === "Néons"
                    ? "bg-gradient-to-r from-fuchsia-600 to-purple-700 border-purple-500 text-white"
                    : "bg-white/3 border-white/6 text-gray-400 hover:text-white hover:bg-white/6")}>
                            {theme}
                          </button>))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Langue</label>
                      <select className="w-full px-4 py-3 bg-white/6 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition">
                        <option>Français</option>
                        <option>English</option>
                        <option>Español</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/6">
                      <div>
                        <h3 className="font-semibold">Animations réduites</h3>
                        <p className="text-sm text-gray-400">Désactiver les animations pour de meilleures performances</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer"/>
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>
                </div>)}

              {activeTab === "integrations" && (<div>
                  <h2 className="text-2xl font-bold mb-6">Intégrations</h2>
                  <div className="space-y-4">
                    {[
                { name: "Slack", description: "Recevoir des notifications dans Slack", connected: true },
                { name: "Discord", description: "Intégration avec Discord", connected: false },
                { name: "Zapier", description: "Automatisez vos workflows", connected: true },
                { name: "Google Workspace", description: "Synchronisation avec Google", connected: false }
            ].map((integration, index) => (<div key={index} className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/6">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${integration.connected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                          <div>
                            <h3 className="font-semibold">{integration.name}</h3>
                            <p className="text-sm text-gray-400">{integration.description}</p>
                          </div>
                        </div>
                        <button className={(0, utils_1.cn)("px-4 py-2 rounded-lg transition", integration.connected
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white")}>
                          {integration.connected ? "Déconnecter" : "Connecter"}
                        </button>
                      </div>))}
                  </div>
                </div>)}

              {activeTab === "api" && (<div>
                  <h2 className="text-2xl font-bold mb-6">Clé API</h2>
                  <div className="space-y-6">
                    <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                      <h3 className="font-semibold text-blue-400 mb-2">Clé API actuelle</h3>
                      <div className="flex items-center gap-3 p-3 bg-white/6 rounded-lg border border-white/10">
                        <code className="flex-1 text-sm font-mono">
                          {showApiKey ? "sk-abc123def456ghi789jkl012mno345pqr" : "••••••••••••••••••••••••••••••••"}
                        </code>
                        <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 text-gray-400 hover:text-white transition">
                          {showApiKey ? <lucide_react_1.EyeOff size={16}/> : <lucide_react_1.Eye size={16}/>}
                        </button>
                        <button onClick={() => copyToClipboard("sk-abc123def456ghi789jkl012mno345pqr")} className="p-2 text-gray-400 hover:text-white transition">
                          {copiedKey ? <lucide_react_1.Check size={16} className="text-green-400"/> : <lucide_react_1.Copy size={16}/>}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition">
                        Régénérer la clé
                      </button>
                      <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition">
                        Documentation API
                      </button>
                    </div>
                    <div className="p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
                      <h3 className="font-semibold text-yellow-400 mb-2">⚠️ Sécurité</h3>
                      <p className="text-sm text-gray-300">
                        Ne partagez jamais votre clé API. Elle donne accès à toutes vos ressources.
                      </p>
                    </div>
                  </div>
                </div>)}
            </div>
          </div>
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map