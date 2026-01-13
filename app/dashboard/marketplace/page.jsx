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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MarketplacePage;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
function MarketplacePage() {
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)('all');
    const [selectedTool, setSelectedTool] = (0, react_1.useState)(null);
    const [showConfigModal, setShowConfigModal] = (0, react_1.useState)(false);
    const [apiConfig, setApiConfig] = (0, react_1.useState)({});
    const [showApiKey, setShowApiKey] = (0, react_1.useState)({});
    // Catalogue MCP Tools
    const mcpTools = [
        {
            id: 'stripe-mcp',
            name: 'Stripe Payments',
            description: 'Gérer les paiements, abonnements et factures Stripe',
            category: 'payments',
            icon: lucide_react_1.Zap,
            rating: 4.9,
            installs: 12453,
            verified: true,
            apiFields: [
                { name: 'stripe_secret_key', label: 'Clé Secrète Stripe', type: 'password', required: true },
                { name: 'stripe_webhook_secret', label: 'Webhook Secret', type: 'password', required: true }
            ],
            capabilities: [
                'Créer des charges et paiements',
                'Gérer les abonnements',
                'Créer des factures',
                'Gérer les clients',
                'Webhooks événements'
            ],
            code: `stripe.charges.create({ amount: 1000, currency: 'eur' })`
        },
        {
            id: 'sendgrid-mcp',
            name: 'SendGrid Email',
            description: 'Envoyer des emails transactionnels et marketing',
            category: 'communication',
            icon: lucide_react_1.Mail,
            rating: 4.8,
            installs: 8932,
            verified: true,
            apiFields: [
                { name: 'sendgrid_api_key', label: 'Clé API SendGrid', type: 'password', required: true },
                { name: 'from_email', label: 'Email Expéditeur', type: 'email', required: true }
            ],
            capabilities: [
                'Envoyer des emails',
                'Templates personnalisés',
                'Tracking ouvertures/clics',
                'Listes de contacts',
                'Analytics'
            ],
            code: `sendEmail({ to: 'user@example.com', subject: 'Hello' })`
        },
        {
            id: 'google-calendar-mcp',
            name: 'Google Calendar',
            description: 'Créer et gérer des événements dans Google Calendar',
            category: 'productivity',
            icon: lucide_react_1.Calendar,
            rating: 4.7,
            installs: 15632,
            verified: true,
            apiFields: [
                { name: 'google_client_id', label: 'Client ID', type: 'text', required: true },
                { name: 'google_client_secret', label: 'Client Secret', type: 'password', required: true },
                { name: 'google_refresh_token', label: 'Refresh Token', type: 'password', required: true }
            ],
            capabilities: [
                'Créer des événements',
                'Lister les calendriers',
                'Modifier/Supprimer événements',
                'Inviter des participants',
                'Notifications'
            ],
            code: `createEvent({ summary: 'Meeting', start: '2024-01-01T10:00:00' })`
        },
        {
            id: 'github-mcp',
            name: 'GitHub',
            description: 'Interagir avec les repositories et issues GitHub',
            category: 'development',
            icon: lucide_react_1.Github,
            rating: 4.9,
            installs: 21045,
            verified: true,
            apiFields: [
                { name: 'github_token', label: 'Personal Access Token', type: 'password', required: true },
                { name: 'github_username', label: 'Username', type: 'text', required: false }
            ],
            capabilities: [
                'Créer/Gérer repositories',
                'Issues et pull requests',
                'Commits et branches',
                'Webhooks',
                'GitHub Actions'
            ],
            code: `createIssue({ repo: 'my-repo', title: 'Bug fix' })`
        },
        {
            id: 'slack-mcp',
            name: 'Slack',
            description: 'Envoyer des messages et notifications Slack',
            category: 'communication',
            icon: lucide_react_1.Slack,
            rating: 4.8,
            installs: 18234,
            verified: true,
            apiFields: [
                { name: 'slack_bot_token', label: 'Bot Token', type: 'password', required: true },
                { name: 'slack_webhook_url', label: 'Webhook URL', type: 'text', required: false }
            ],
            capabilities: [
                'Envoyer des messages',
                'Créer des channels',
                'Inviter des utilisateurs',
                'Fichiers et médias',
                'Slash commands'
            ],
            code: `postMessage({ channel: '#general', text: 'Hello!' })`
        },
        {
            id: 'notion-mcp',
            name: 'Notion',
            description: 'Créer et gérer des pages et bases de données Notion',
            category: 'productivity',
            icon: lucide_react_1.Database,
            rating: 4.6,
            installs: 9876,
            verified: true,
            apiFields: [
                { name: 'notion_api_key', label: 'Integration Token', type: 'password', required: true },
                { name: 'notion_database_id', label: 'Database ID (optionnel)', type: 'text', required: false }
            ],
            capabilities: [
                'Créer des pages',
                'Gérer bases de données',
                'Blocs et contenu',
                'Recherche avancée',
                'Synchronisation temps réel'
            ],
            code: `createPage({ parent: { database_id: 'db-id' }, properties: { Name: { title: [{ text: { content: 'New Page' } }] } } })`
        }
    ];
    const categories = [
        { id: 'all', name: 'Tous', count: mcpTools.length },
        { id: 'payments', name: 'Paiements', count: mcpTools.filter(t => t.category === 'payments').length },
        { id: 'communication', name: 'Communication', count: mcpTools.filter(t => t.category === 'communication').length },
        { id: 'productivity', name: 'Productivité', count: mcpTools.filter(t => t.category === 'productivity').length },
        { id: 'development', name: 'Développement', count: mcpTools.filter(t => t.category === 'development').length }
    ];
    const filteredTools = mcpTools.filter(tool => {
        const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    const handleInstall = (tool) => {
        setSelectedTool(tool);
        setApiConfig({});
        setShowConfigModal(true);
    };
    const handleSaveConfig = () => {
        console.log('Configuration sauvegardée:', { tool: selectedTool?.id, config: apiConfig });
        alert(`✅ ${selectedTool?.name} configuré avec succès !`);
        setShowConfigModal(false);
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copié dans le presse-papiers !');
    };
    return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
            <lucide_react_1.Package className="w-10 h-10 mr-3 text-purple-400"/>
            Marketplace MCP
          </h1>
          <p className="text-gray-400">
            Connectez vos agents IA à plus de {mcpTools.length} services et APIs
          </p>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <lucide_react_1.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
            <input type="text" placeholder="Rechercher un outil MCP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-purple-500/20 rounded-xl text-black placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"/>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (<button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-2 rounded-lg font-medium transition ${selectedCategory === cat.id
                ? 'bg-purple-500 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'}`}>
                {cat.name} ({cat.count})
              </button>))}
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (<div key={tool.id} className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl hover:border-purple-500/50 transition group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <tool.icon className="w-6 h-6 text-purple-400"/>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center">
                      {tool.name}
                      {tool.verified && (<lucide_react_1.CheckCircle className="w-4 h-4 text-blue-400 ml-2"/>)}
                    </h3>
                  </div>
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-4">{tool.description}</p>

              <div className="flex items-center space-x-4 mb-4 text-sm">
                <div className="flex items-center text-yellow-400">
                  <lucide_react_1.Star className="w-4 h-4 mr-1 fill-current"/>
                  <span>{tool.rating}</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <lucide_react_1.Download className="w-4 h-4 mr-1"/>
                  <span>{tool.installs.toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">Capacités:</div>
                <div className="space-y-1">
                  {tool.capabilities.slice(0, 3).map((cap, idx) => (<div key={idx} className="flex items-center text-xs text-gray-400">
                      <lucide_react_1.CheckCircle className="w-3 h-3 mr-2 text-green-400"/>
                      {cap}
                    </div>))}
                </div>
              </div>

              <button onClick={() => handleInstall(tool)} className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                Installer & Configurer
              </button>
            </div>))}
        </div>

        {/* Configuration Modal */}
        {showConfigModal && selectedTool && (<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black rounded-2xl border border-purple-500/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-purple-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <selectedTool.icon className="w-8 h-8 text-purple-400"/>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Configuration {selectedTool.name}
                      </h2>
                      <p className="text-sm text-gray-400">
                        Entrez vos clés API pour connecter ce service
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-white">
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* API Fields */}
                <div className="space-y-4">
                  {selectedTool.apiFields.map((field) => (<div key={field.name}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <div className="relative">
                        <lucide_react_1.Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                        <input type={showApiKey[field.name] ? 'text' : field.type} value={apiConfig[field.name] || ''} onChange={(e) => setApiConfig({ ...apiConfig, [field.name]: e.target.value })} placeholder={`Votre ${field.label.toLowerCase()}`} className="w-full pl-11 pr-11 py-3 bg-slate-700/50 border border-slate-600 text-black rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"/>
                        {field.type === 'password' && (<button onClick={() => setShowApiKey({ ...showApiKey, [field.name]: !showApiKey[field.name] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                            {showApiKey[field.name] ? <lucide_react_1.EyeOff className="w-5 h-5"/> : <lucide_react_1.Eye className="w-5 h-5"/>}
                          </button>)}
                      </div>
                    </div>))}
                </div>

                {/* Code Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">
                      Exemple d'utilisation
                    </label>
                    <button onClick={() => copyToClipboard(selectedTool.code)} className="flex items-center space-x-1 text-xs text-purple-400 hover:text-purple-300">
                      <lucide_react_1.Copy className="w-4 h-4"/>
                      <span>Copier</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 rounded-lg overflow-x-auto">
                    <code className="text-green-400 text-sm">{selectedTool.code}</code>
                  </pre>
                </div>

                {/* Capabilities List */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Capacités incluses
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTool.capabilities.map((cap, idx) => (<div key={idx} className="flex items-center text-sm text-gray-400">
                        <lucide_react_1.CheckCircle className="w-4 h-4 mr-2 text-green-400"/>
                        {cap}
                      </div>))}
                  </div>
                </div>

                {/* Security Note */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start space-x-3">
                  <lucide_react_1.Lock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"/>
                  <div className="text-sm text-yellow-200">
                    <strong>Sécurité :</strong> Vos clés API sont chiffrées et stockées en toute sécurité.
                    Elles ne sont jamais exposées côté client et sont uniquement utilisées pour les appels API serveur.
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-purple-500/20 flex space-x-3">
                <button onClick={() => setShowConfigModal(false)} className="flex-1 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition">
                  Annuler
                </button>
                <button onClick={handleSaveConfig} className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                  Sauvegarder et Activer
                </button>
              </div>
            </div>
          </div>)}
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map