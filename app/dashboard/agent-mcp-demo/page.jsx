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
exports.default = AgentMCPDemo;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
function AgentMCPDemo() {
    const [isProcessing, setIsProcessing] = (0, react_1.useState)(false);
    const [actions, setActions] = (0, react_1.useState)([]);
    const [currentTask, setCurrentTask] = (0, react_1.useState)('');
    // Fonction pour simuler l'exécution d'un agent avec MCP tools
    const executeAgentWithMCP = async (task) => {
        setIsProcessing(true);
        setCurrentTask(task);
        setActions([]);
        // Simulation des étapes MCP
        const steps = [
            {
                id: '1',
                type: 'analysis',
                title: 'Analyse de la demande',
                description: 'L\'agent analyse votre demande avec IA',
                status: 'processing'
            },
            {
                id: '2',
                type: 'payment',
                title: 'Création paiement Stripe',
                description: 'Intégration MCP Stripe pour traiter le paiement',
                status: 'pending'
            },
            {
                id: '3',
                type: 'email',
                title: 'Envoi email SendGrid',
                description: 'Intégration MCP SendGrid pour notification',
                status: 'pending'
            },
            {
                id: '4',
                type: 'github',
                title: 'Création issue GitHub',
                description: 'Intégration MCP GitHub pour suivi',
                status: 'pending'
            }
        ];
        // Simulation de l'exécution étape par étape
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            // Ajouter l'action
            setActions(prev => [...prev, { ...step, status: 'processing' }]);
            // Simulation du traitement
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Mettre à jour le statut
            setActions(prev => prev.map(action => action.id === step.id
                ? { ...action, status: 'completed', result: getMockResult(step.type) }
                : action));
        }
        setIsProcessing(false);
        setCurrentTask('');
    };
    const getMockResult = (type) => {
        switch (type) {
            case 'payment':
                return {
                    payment_id: 'pi_' + Math.random().toString(36).substr(2, 9),
                    amount: 29.99,
                    currency: 'EUR',
                    status: 'succeeded'
                };
            case 'email':
                return {
                    message_id: 'msg_' + Math.random().toString(36).substr(2, 9),
                    to: 'client@example.com',
                    subject: 'Confirmation de commande',
                    status: 'delivered'
                };
            case 'github':
                return {
                    issue_number: Math.floor(Math.random() * 1000),
                    title: 'Nouvelle demande client',
                    url: 'https://github.com/user/repo/issues/123'
                };
            default:
                return { analysis: 'Demande analysée avec succès' };
        }
    };
    const getActionIcon = (type) => {
        switch (type) {
            case 'payment': return lucide_react_1.CreditCard;
            case 'email': return lucide_react_1.Mail;
            case 'github': return lucide_react_1.Github;
            default: return lucide_react_1.Bot;
        }
    };
    const getActionColor = (type) => {
        switch (type) {
            case 'payment': return 'text-green-400';
            case 'email': return 'text-blue-400';
            case 'github': return 'text-purple-400';
            default: return 'text-orange-400';
        }
    };
    const demoTasks = [
        {
            title: "Créer une facture et envoyer par email",
            description: "L'agent va créer un paiement Stripe, générer une facture et l'envoyer par email via SendGrid"
        },
        {
            title: "Analyser les ventes et créer un rapport",
            description: "L'agent analyse les données Stripe et crée un rapport GitHub avec les insights"
        },
        {
            title: "Gestion complète d'une commande client",
            description: "Traitement de A à Z : paiement → email → suivi GitHub"
        }
    ];
    return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
            <lucide_react_1.Bot className="w-10 h-10 mr-3 text-purple-400"/>
            Agent MCP Complet - Démonstration
          </h1>
          <p className="text-gray-400">
            Exemple d'agent utilisant Stripe, SendGrid et GitHub via outils MCP
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Panel gauche - Contrôles */}
          <div className="space-y-6">
            {/* Informations sur l'agent */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <lucide_react_1.Zap className="w-5 h-5 mr-2 text-yellow-400"/>
                Agent E-commerce Intelligent
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-green-400">
                  <lucide_react_1.CheckCircle className="w-4 h-4 mr-2"/>
                  Stripe MCP - Gestion des paiements
                </div>
                <div className="flex items-center text-blue-400">
                  <lucide_react_1.CheckCircle className="w-4 h-4 mr-2"/>
                  SendGrid MCP - Envoi d'emails
                </div>
                <div className="flex items-center text-purple-400">
                  <lucide_react_1.CheckCircle className="w-4 h-4 mr-2"/>
                  GitHub MCP - Suivi des demandes
                </div>
              </div>
            </div>

            {/* Tâches de démonstration */}
            <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Tâches de démonstration</h3>
              <div className="space-y-3">
                {demoTasks.map((task, index) => (<button key={index} onClick={() => executeAgentWithMCP(task.title)} disabled={isProcessing} className="w-full p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-pink-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-left">
                    <div className="font-semibold text-white">{task.title}</div>
                    <div className="text-sm text-gray-400 mt-1">{task.description}</div>
                  </button>))}
              </div>
            </div>

            {/* Status actuel */}
            {currentTask && (<div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center text-blue-400">
                  <lucide_react_1.Loader2 className="w-5 h-5 mr-2 animate-spin"/>
                  <span className="font-semibold">Traitement en cours...</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{currentTask}</p>
              </div>)}
          </div>

          {/* Panel droit - Journal des actions */}
          <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <lucide_react_1.MessageSquare className="w-5 h-5 mr-2"/>
              Journal des Actions MCP
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {actions.length === 0 && !isProcessing && (<div className="text-center text-gray-400 py-8">
                  <lucide_react_1.Bot className="w-12 h-12 mx-auto mb-3 opacity-50"/>
                  <p>Sélectionnez une tâche pour voir l'agent en action</p>
                </div>)}

              {actions.map((action) => {
            const Icon = getActionIcon(action.type);
            const colorClass = getActionColor(action.type);
            return (<div key={action.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg bg-slate-600 ${colorClass}`}>
                        <Icon className="w-5 h-5"/>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white">{action.title}</h4>
                          <div className="flex items-center">
                            {action.status === 'processing' && (<lucide_react_1.Loader2 className="w-4 h-4 animate-spin text-blue-400"/>)}
                            {action.status === 'completed' && (<lucide_react_1.CheckCircle className="w-4 h-4 text-green-400"/>)}
                            {action.status === 'failed' && (<lucide_react_1.AlertCircle className="w-4 h-4 text-red-400"/>)}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{action.description}</p>

                        {action.result && action.status === 'completed' && (<div className="mt-3 p-3 bg-slate-800/50 rounded border border-slate-600">
                            <div className="text-xs text-gray-500 mb-2">Résultat MCP :</div>
                            <pre className="text-xs text-green-400 overflow-x-auto">
                              {JSON.stringify(action.result, null, 2)}
                            </pre>
                          </div>)}
                      </div>
                    </div>
                  </div>);
        })}
            </div>
          </div>
        </div>

        {/* Code example */}
        <div className="mt-8 p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <lucide_react_1.Code className="w-5 h-5 mr-2"/>
            Exemple d'utilisation des outils MCP
          </h3>
          <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="text-green-400">{`// Agent avec intégration MCP complète
const agent = new MCAgent({
  tools: {
    stripe: await loadStripeMCP(),
    sendgrid: await loadSendGridMCP(),
    github: await loadGitHubMCP()
  }
});

// Traitement d'une commande client
await agent.processOrder({
  customer: "client@example.com",
  amount: 29.99,
  product: "Service Premium"
});

// Résultat : Paiement + Email + Issue GitHub créés automatiquement`}</code>
          </pre>
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map