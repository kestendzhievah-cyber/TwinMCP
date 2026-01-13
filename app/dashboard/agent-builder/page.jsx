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
exports.default = AgentBuilderPage;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const LimitsDisplay_1 = require("../../../components/ui/LimitsDisplay");
const LimitReachedModal_1 = require("../../../components/ui/LimitReachedModal");
function AgentBuilderPage() {
    const [agentName, setAgentName] = (0, react_1.useState)('Mon Agent IA');
    const [agentDescription, setAgentDescription] = (0, react_1.useState)('');
    const [selectedModel, setSelectedModel] = (0, react_1.useState)('gpt-4');
    const [systemPrompt, setSystemPrompt] = (0, react_1.useState)('Tu es un assistant IA utile et professionnel.');
    const [temperature, setTemperature] = (0, react_1.useState)(0.7);
    const [maxTokens, setMaxTokens] = (0, react_1.useState)(1000);
    const [messages, setMessages] = (0, react_1.useState)([
        { role: 'assistant', content: 'Bonjour ! Je suis votre nouvel agent IA. Comment puis-je vous aider ?' }
    ]);
    const [inputMessage, setInputMessage] = (0, react_1.useState)('');
    const [isTyping, setIsTyping] = (0, react_1.useState)(false);
    const [showToolsModal, setShowToolsModal] = (0, react_1.useState)(false);
    const [connectedTools, setConnectedTools] = (0, react_1.useState)([]);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    // Nouveaux états pour la gestion des limites
    const [userLimits, setUserLimits] = (0, react_1.useState)(null);
    const [showLimitModal, setShowLimitModal] = (0, react_1.useState)(false);
    const [limitModalData, setLimitModalData] = (0, react_1.useState)(null);
    const [isLoadingLimits, setIsLoadingLimits] = (0, react_1.useState)(true);
    const availableModels = [
        {
            id: 'gpt-4',
            name: 'GPT-4 Turbo',
            provider: 'OpenAI',
            cost: '0.01€/1K tokens',
            speed: 'Rapide',
            quality: 5,
            description: 'Le plus puissant, raisonnement avancé'
        },
        {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            provider: 'OpenAI',
            cost: '0.002€/1K tokens',
            speed: 'Très rapide',
            quality: 4,
            description: 'Rapide et économique pour tâches simples'
        },
        {
            id: 'claude-3-opus',
            name: 'Claude 3 Opus',
            provider: 'Anthropic',
            cost: '0.015€/1K tokens',
            speed: 'Rapide',
            quality: 5,
            description: 'Excellence en analyse et créativité'
        },
        {
            id: 'claude-3-haiku',
            name: 'Claude 3 Haiku',
            provider: 'Anthropic',
            cost: '0.00025€/1K tokens',
            speed: 'Ultra rapide',
            quality: 4,
            description: 'Rapide et efficace pour réponses courtes'
        },
        {
            id: 'gemini-pro',
            name: 'Gemini Pro',
            provider: 'Google',
            cost: '0.0005€/1K tokens',
            speed: 'Très rapide',
            quality: 4,
            description: 'Polyvalent avec excellentes performances'
        }
    ];
    const availableMCPTools = [
        {
            id: 'email',
            name: 'Email',
            description: 'Envoyer et recevoir des emails',
            icon: lucide_react_1.Mail,
            color: 'blue',
            configured: true
        },
        {
            id: 'calendar',
            name: 'Calendrier',
            description: 'Gérer les événements et rendez-vous',
            icon: lucide_react_1.Calendar,
            color: 'green',
            configured: true
        },
        {
            id: 'github',
            name: 'GitHub',
            description: 'Accéder aux repositories et issues',
            icon: lucide_react_1.Github,
            color: 'purple',
            configured: false
        },
        {
            id: 'slack',
            name: 'Slack',
            description: 'Intégration avec Slack',
            icon: lucide_react_1.Slack,
            color: 'red',
            configured: false
        },
        {
            id: 'database',
            name: 'Base de Données',
            description: 'Requêtes SQL personnalisées',
            icon: lucide_react_1.Database,
            color: 'yellow',
            configured: true
        },
        {
            id: 'api',
            name: 'API Personnalisée',
            description: 'Appels vers des APIs externes',
            icon: lucide_react_1.Zap,
            color: 'orange',
            configured: false
        }
    ];
    // Charger les limites utilisateur au montage du composant
    (0, react_1.useEffect)(() => {
        loadUserLimits();
    }, []);
    const loadUserLimits = async () => {
        setIsLoadingLimits(true);
        try {
            const token = localStorage.getItem('authToken'); // Ou récupérer depuis le contexte d'auth
            if (!token) {
                // Simulation des données pour le développement
                setUserLimits({
                    plan: 'professional',
                    limits: {
                        agents: {
                            current: 3,
                            max: 5,
                            remaining: 2,
                            percentage: 60
                        },
                        conversations: {
                            current: 5234,
                            max: 10000,
                            remaining: 4766,
                            percentage: 52
                        }
                    },
                    canCreateAgent: true,
                    suggestedUpgrade: null,
                    subscriptionStatus: 'active'
                });
                return;
            }
            const response = await fetch('/api/user/limits', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setUserLimits(data);
            }
            else {
                // Fallback pour le développement
                console.warn('Failed to load user limits, using fallback data');
                setUserLimits({
                    plan: 'professional',
                    limits: {
                        agents: {
                            current: 3,
                            max: 5,
                            remaining: 2,
                            percentage: 60
                        },
                        conversations: {
                            current: 5234,
                            max: 10000,
                            remaining: 4766,
                            percentage: 52
                        }
                    },
                    canCreateAgent: true,
                    suggestedUpgrade: null,
                    subscriptionStatus: 'active'
                });
            }
        }
        catch (error) {
            console.error('Error loading user limits:', error);
            // Fallback pour le développement
            setUserLimits({
                plan: 'professional',
                limits: {
                    agents: {
                        current: 3,
                        max: 5,
                        remaining: 2,
                        percentage: 60
                    },
                    conversations: {
                        current: 5234,
                        max: 10000,
                        remaining: 4766,
                        percentage: 52
                    }
                },
                canCreateAgent: true,
                suggestedUpgrade: null,
                subscriptionStatus: 'active'
            });
        }
        finally {
            setIsLoadingLimits(false);
        }
    };
    const handleSendMessage = async () => {
        if (!inputMessage.trim())
            return;
        const userMessage = inputMessage;
        setInputMessage('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsTyping(true);
        setTimeout(() => {
            const responses = [
                'Je traite votre demande avec les outils connectés...',
                'Voici les informations que j\'ai trouvées.',
                'J\'ai exécuté l\'action demandée avec succès !',
                'Puis-je vous aider avec autre chose ?'
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            setMessages(prev => [...prev, { role: 'assistant', content: randomResponse }]);
            setIsTyping(false);
        }, 1500);
    };
    const toggleTool = (toolId) => {
        setConnectedTools(prev => prev.includes(toolId)
            ? prev.filter(id => id !== toolId)
            : [...prev, toolId]);
    };
    const handleSaveAgent = async () => {
        if (!userLimits || !userLimits.canCreateAgent) {
            // Afficher le modal de limite atteinte
            if (userLimits) {
                setLimitModalData({
                    current: userLimits.limits.agents.current,
                    max: userLimits.limits.agents.max,
                    plan: userLimits.plan,
                    suggestedPlan: userLimits.suggestedUpgrade,
                    message: `Vous avez déjà créé ${userLimits.limits.agents.current}/${userLimits.limits.agents.max} agents avec votre plan ${userLimits.plan}.`
                });
                setShowLimitModal(true);
            }
            return;
        }
        setIsSaving(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/chatbot/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: agentName,
                    description: agentDescription,
                    model: selectedModel,
                    systemPrompt,
                    temperature,
                    maxTokens
                })
            });
            const result = await response.json();
            if (response.ok) {
                // Succès
                if (userLimits) {
                    alert(`✅ Agent créé avec succès ! (${result.newCount}/${userLimits.limits.agents.max})`);
                }
                // Recharger les limites
                await loadUserLimits();
            }
            else if (result.error === 'LIMIT_REACHED') {
                // Limite atteinte côté serveur
                setLimitModalData({
                    current: result.currentCount,
                    max: result.maxAllowed,
                    plan: result.plan,
                    suggestedPlan: result.suggestedPlan,
                    message: result.message
                });
                setShowLimitModal(true);
            }
            else {
                alert('❌ Erreur lors de la création de l\'agent: ' + result.error);
            }
        }
        catch (error) {
            console.error('Error creating agent:', error);
            alert('❌ Erreur lors de la création de l\'agent');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleManageAgents = () => {
        // Rediriger vers la page de gestion des agents
        window.location.href = '/dashboard/chatbot';
    };
    const handleUpgrade = () => {
        // Rediriger vers la page de pricing
        window.location.href = '/pricing';
    };
    const handleTestAgent = () => {
        setMessages([
            { role: 'assistant', content: 'Mode test activé ! Essayez de me parler.' }
        ]);
    };
    return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header avec affichage des limites */}
        <div className="mb-6 grid lg:grid-cols-3 gap-6">
          {/* Limits Display - prend 2 colonnes sur desktop */}
          <div className="lg:col-span-2">
            {userLimits ? (<LimitsDisplay_1.LimitsDisplay limits={userLimits.limits} showUpgradeButton={true} onUpgrade={handleUpgrade}/>) : (<div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
                    <p className="text-gray-400">Chargement des limites...</p>
                  </div>
                </div>
              </div>)}
          </div>

          {/* Agent Builder Header */}
          <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="text-2xl font-bold text-white bg-transparent border-none outline-none mb-2 w-full" placeholder="Nom de l'agent"/>
                <input type="text" value={agentDescription} onChange={(e) => setAgentDescription(e.target.value)} className="text-gray-400 bg-transparent border-none outline-none w-full" placeholder="Description de l'agent (optionnel)"/>
              </div>
              <div className="flex space-x-3">
                <button onClick={handleTestAgent} className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition flex items-center">
                  <lucide_react_1.Play className="w-4 h-4 mr-2"/>
                  Tester
                </button>
                <button onClick={handleSaveAgent} disabled={isSaving || !userLimits?.canCreateAgent} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition flex items-center disabled:opacity-50">
                  {isSaving ? (<>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"/>
                      Sauvegarde...
                    </>) : (<>
                      <lucide_react_1.Save className="w-4 h-4 mr-2"/>
                      Sauvegarder
                    </>)}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* Model Selection */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <lucide_react_1.Sparkles className="w-5 h-5 mr-2 text-purple-400"/>
                Modèle IA
              </h3>
              <div className="space-y-3">
                {availableModels.map((model) => (<div key={model.id} onClick={() => setSelectedModel(model.id)} className={`p-4 rounded-lg border cursor-pointer transition ${selectedModel === model.id
                ? 'bg-purple-500/20 border-purple-500'
                : 'bg-slate-700/50 border-slate-600 hover:border-purple-500/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-white">{model.name}</div>
                        <div className="text-xs text-gray-400">{model.provider}</div>
                      </div>
                      {selectedModel === model.id && (<lucide_react_1.CheckCircle className="w-5 h-5 text-purple-400"/>)}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{model.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Coût: {model.cost}</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (<span key={i} className={i < model.quality ? 'text-yellow-400' : 'text-gray-600'}>★</span>))}
                      </div>
                    </div>
                  </div>))}
              </div>
            </div>

            {/* Parameters */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <lucide_react_1.Settings className="w-5 h-5 mr-2 text-purple-400"/>
                Paramètres
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Température: {temperature}
                  </label>
                  <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full"/>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Précis</span>
                    <span>Créatif</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tokens Maximum: {maxTokens}
                  </label>
                  <input type="range" min="100" max="4000" step="100" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="w-full"/>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Court</span>
                    <span>Long</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Tools */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <lucide_react_1.Zap className="w-5 h-5 mr-2 text-purple-400"/>
                  Outils MCP ({connectedTools.length})
                </h3>
                <button onClick={() => setShowToolsModal(true)} className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition">
                  <lucide_react_1.Plus className="w-4 h-4"/>
                </button>
              </div>

              <div className="space-y-2">
                {connectedTools.length === 0 ? (<div className="text-center py-6">
                    <lucide_react_1.Zap className="w-12 h-12 text-gray-600 mx-auto mb-2"/>
                    <p className="text-sm text-gray-400">Aucun outil connecté</p>
                    <button onClick={() => setShowToolsModal(true)} className="mt-3 text-xs text-purple-400 hover:text-purple-300">
                      Ajouter des outils
                    </button>
                  </div>) : (connectedTools.map((toolId) => {
            const tool = availableMCPTools.find(t => t.id === toolId);
            if (!tool)
                return null;
            return (<div key={toolId} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <tool.icon className={`w-5 h-5 text-${tool.color}-400`}/>
                          <div>
                            <div className="text-white font-medium text-sm">{tool.name}</div>
                            <div className="text-xs text-gray-400">{tool.description}</div>
                          </div>
                        </div>
                        <button onClick={() => toggleTool(toolId)} className="text-gray-400 hover:text-red-400 transition">
                          <lucide_react_1.X className="w-4 h-4"/>
                        </button>
                      </div>);
        }))}
              </div>
            </div>

            {/* System Prompt */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Instructions Système</h3>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="w-full h-32 bg-slate-700/50 text-white rounded-lg p-3 border border-slate-600 focus:border-purple-500 outline-none resize-none text-sm" placeholder="Définissez le comportement de votre agent..."/>
              <p className="text-xs text-gray-500 mt-2">
                Ces instructions guident le comportement général de l'agent
              </p>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="h-full bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl flex flex-col">
              {/* Chat Header */}
              <div className="p-6 border-b border-purple-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <lucide_react_1.MessageSquare className="w-6 h-6 mr-2 text-purple-400"/>
                      Test de l'Agent
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Testez votre agent en temps réel
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
                      <span className="text-xs text-green-400">Actif</span>
                    </div>
                    <button className="p-2 hover:bg-slate-700 rounded-lg transition">
                      <lucide_react_1.Trash2 className="w-4 h-4 text-gray-400"/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ minHeight: '500px' }}>
                {messages.map((message, index) => (<div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${message.role === 'user'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-slate-700/50 text-white border border-slate-600'} p-4 rounded-lg`}>
                      {message.content}
                    </div>
                  </div>))}

                {isTyping && (<div className="flex justify-start">
                    <div className="bg-slate-700/50 border border-slate-600 p-4 rounded-lg">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"/>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}/>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}/>
                      </div>
                    </div>
                  </div>)}
              </div>

              {/* Input */}
              <div className="p-6 border-t border-purple-500/20">
                <div className="flex space-x-3">
                  <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Testez votre agent..." className="flex-1 bg-slate-700/50 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-purple-500 outline-none"/>
                  <button onClick={handleSendMessage} disabled={isTyping} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50 disabled:opacity-50">
                    <lucide_react_1.Send className="w-5 h-5"/>
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                  <span>Tokens utilisés: ~{messages.length * 50}</span>
                  <span>Coût estimé: ~0.05€</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tools Modal */}
        {showToolsModal && (<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-purple-500/20 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-purple-500/20 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-white">Bibliothèque d'Outils MCP</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Sélectionnez les outils que votre agent pourra utiliser
                  </p>
                </div>
                <button onClick={() => setShowToolsModal(false)} className="p-2 hover:bg-slate-700 rounded-lg transition">
                  <lucide_react_1.X className="w-6 h-6 text-gray-400"/>
                </button>
              </div>

              <div className="p-6 grid md:grid-cols-2 gap-4">
                {availableMCPTools.map((tool) => (<div key={tool.id} onClick={() => tool.configured && toggleTool(tool.id)} className={`p-6 rounded-xl border cursor-pointer transition ${connectedTools.includes(tool.id)
                    ? 'bg-purple-500/20 border-purple-500'
                    : tool.configured
                        ? 'bg-slate-700/50 border-slate-600 hover:border-purple-500/50'
                        : 'bg-slate-700/30 border-slate-600/50 cursor-not-allowed opacity-50'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <tool.icon className={`w-8 h-8 text-${tool.color}-400`}/>
                      {connectedTools.includes(tool.id) ? (<div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded border border-green-500/30">
                          Connecté
                        </div>) : tool.configured ? (<div className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded border border-blue-500/30">
                          Disponible
                        </div>) : (<div className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs font-semibold rounded border border-gray-500/30">
                          Non configuré
                        </div>)}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{tool.name}</h3>
                    <p className="text-sm text-gray-400">{tool.description}</p>
                    {!tool.configured && (<a href="/marketplace" className="mt-3 inline-block text-xs text-purple-400 hover:text-purple-300" onClick={(e) => e.stopPropagation()}>
                        Configurer dans le marketplace →
                      </a>)}
                  </div>))}
              </div>

              <div className="p-6 border-t border-purple-500/20 sticky bottom-0 bg-slate-800">
                <button onClick={() => setShowToolsModal(false)} className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                  Confirmer ({connectedTools.length} outils sélectionnés)
                </button>
              </div>
            </div>
          </div>)}

        {/* Limit Reached Modal */}
        {limitModalData && (<LimitReachedModal_1.LimitReachedModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} data={limitModalData} onManageAgents={handleManageAgents} onUpgrade={handleUpgrade}/>)}
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map