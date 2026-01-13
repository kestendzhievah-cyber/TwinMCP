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
exports.default = AgentBuilder;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
function AgentBuilder() {
    const [messages, setMessages] = (0, react_1.useState)([
        { role: 'assistant', content: 'Bonjour ! Je suis votre nouvel agent IA. Vous pouvez me configurer et me tester ici.' }
    ]);
    const [input, setInput] = (0, react_1.useState)('');
    const [showToolsModal, setShowToolsModal] = (0, react_1.useState)(false);
    const [selectedModel, setSelectedModel] = (0, react_1.useState)('gpt-4');
    const [agentName, setAgentName] = (0, react_1.useState)('Mon Agent IA');
    const [connectedTools, setConnectedTools] = (0, react_1.useState)(['email']);
    const toggleTool = (toolId) => {
        setConnectedTools(prev => (prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]));
    };
    const availableModels = [
        { id: 'gpt-4', name: 'GPT-4 Turbo', cost: '0.01€/1K tokens', speed: 'Rapide', quality: '⭐⭐⭐⭐⭐' },
        { id: 'gpt-3.5', name: 'GPT-3.5 Turbo', cost: '0.002€/1K tokens', speed: 'Très rapide', quality: '⭐⭐⭐⭐' },
        { id: 'claude-3', name: 'Claude 3 Opus', cost: '0.015€/1K tokens', speed: 'Rapide', quality: '⭐⭐⭐⭐⭐' },
        { id: 'gemini-pro', name: 'Gemini Pro', cost: '0.0005€/1K tokens', speed: 'Ultra rapide', quality: '⭐⭐⭐⭐' }
    ];
    const availableTools = [
        { id: 'email', name: 'Email', icon: lucide_react_1.Mail, description: 'Envoyer et recevoir des emails', connected: true },
        { id: 'calendar', name: 'Google Calendar', icon: lucide_react_1.Calendar, description: 'Gérer les événements', connected: false },
        { id: 'github', name: 'GitHub', icon: lucide_react_1.Github, description: 'Accès aux repositories', connected: false },
        { id: 'slack', name: 'Slack', icon: lucide_react_1.Slack, description: 'Envoyer des messages', connected: false },
        { id: 'database', name: 'Database', icon: lucide_react_1.Database, description: 'Accès aux données', connected: false },
        { id: 'crm', name: 'CRM', icon: lucide_react_1.MessageSquare, description: 'Gérer les contacts', connected: false }
    ];
    const handleSendMessage = () => {
        if (!input.trim())
            return;
        setMessages([...messages,
            { role: 'user', content: input },
            { role: 'assistant', content: 'Je traite votre demande avec les outils connectés...' }
        ]);
        setInput('');
    };
    const handleDeployAgent = async () => {
        try {
            const agentData = {
                name: agentName,
                description: 'Agent créé via le builder',
                capabilities: connectedTools,
            };
            // Call MCP server to create agent
            const response = await fetch('http://localhost:3001/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toolName: 'create_agent',
                    parameters: agentData,
                }),
            });
            const result = await response.json();
            alert(`Agent déployé ! ${result.result}`);
        }
        catch (error) {
            console.error('Erreur lors du déploiement:', error);
            alert('Erreur lors du déploiement de l\'agent');
        }
    };
    return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="text-2xl font-bold text-white bg-transparent border-none outline-none mb-2"/>
              <p className="text-gray-400">Configurez et testez votre agent IA</p>
            </div>
            <button onClick={handleDeployAgent} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50">
              Déployer l'Agent
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
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
                      <span className="font-semibold text-white">{model.name}</span>
                      {selectedModel === model.id && <lucide_react_1.Check className="w-5 h-5 text-purple-400"/>}
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="text-gray-400">Coût: <span className="text-white">{model.cost}</span></div>
                      <div className="text-gray-400">Vitesse: <span className="text-white">{model.speed}</span></div>
                      <div className="text-gray-400">Qualité: <span className="text-white">{model.quality}</span></div>
                    </div>
                  </div>))}
              </div>
            </div>

            {/* Connected Tools */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <lucide_react_1.Settings className="w-5 h-5 mr-2 text-purple-400"/>
                  Outils Connectés
                </h3>
                <button onClick={() => setShowToolsModal(true)} className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition">
                  <lucide_react_1.Plus className="w-4 h-4"/>
                </button>
              </div>
              
              <div className="space-y-2">
                {connectedTools.length === 0 ? (<p className="text-sm text-gray-400 text-center py-4">
                    Aucun outil connecté
                  </p>) : (connectedTools.map((toolId) => {
            const tool = availableTools.find(t => t.id === toolId);
            if (!tool)
                return null;
            return (<div key={toolId} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <tool.icon className="w-5 h-5 text-purple-400"/>
                          <span className="text-white font-medium">{tool.name}</span>
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
              <textarea className="w-full h-32 bg-slate-700/50 text-white rounded-lg p-3 border border-slate-600 focus:border-purple-500 outline-none resize-none" placeholder="Décrivez le comportement de votre agent..." defaultValue="Tu es un assistant commercial expert qui aide les clients à trouver le bon produit."/>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="h-[calc(100vh-200px)] bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-purple-500/20">
                <h3 className="text-lg font-bold text-white">Test de l'Agent</h3>
                <p className="text-sm text-gray-400">Testez votre agent en temps réel</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message, index) => (<div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-lg ${message.role === 'user'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-slate-700/50 text-white border border-slate-600'}`}>
                      {message.content}
                    </div>
                  </div>))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-purple-500/20">
                <div className="flex space-x-2">
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Testez votre agent..." className="flex-1 bg-slate-700/50 text-white rounded-lg px-4 py-3 border border-slate-600 focus:border-purple-500 outline-none"/>
                  <button onClick={handleSendMessage} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/50">
                    <lucide_react_1.Send className="w-5 h-5"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Modal */}
      {showToolsModal && (<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-purple-500/20 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-purple-500/20 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Bibliothèque d'Outils</h2>
              <button onClick={() => setShowToolsModal(false)} className="p-2 hover:bg-slate-700 rounded-lg transition">
                <lucide_react_1.X className="w-6 h-6 text-gray-400"/>
              </button>
            </div>

            <div className="p-6 grid md:grid-cols-2 gap-4">
              {availableTools.map((tool) => (<div key={tool.id} onClick={() => toggleTool(tool.id)} className={`p-6 rounded-xl border cursor-pointer transition ${connectedTools.includes(tool.id)
                    ? 'bg-purple-500/20 border-purple-500'
                    : 'bg-slate-700/50 border-slate-600 hover:border-purple-500/50'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <tool.icon className="w-8 h-8 text-purple-400"/>
                    {connectedTools.includes(tool.id) && (<div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded border border-green-500/30">
                        Connecté
                      </div>)}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{tool.name}</h3>
                  <p className="text-sm text-gray-400">{tool.description}</p>
                </div>))}
            </div>

            <div className="p-6 border-t border-purple-500/20">
              <button onClick={() => setShowToolsModal(false)} className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition">
                Confirmer
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
//# sourceMappingURL=page.jsx.map