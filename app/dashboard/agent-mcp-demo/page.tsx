'use client';

import React, { useState } from 'react';
import { Bot, Zap, CreditCard, Mail, Github, Send, CheckCircle, AlertCircle, Loader2, Code, MessageSquare, ShoppingCart, Users, Star } from 'lucide-react';

interface AgentAction {
  id: string;
  type: 'payment' | 'email' | 'github' | 'analysis';
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
}

export default function AgentMCPDemo() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [currentTask, setCurrentTask] = useState('');

  // Fonction pour simuler l'exécution d'un agent avec MCP tools
  const executeAgentWithMCP = async (task: string) => {
    setIsProcessing(true);
    setCurrentTask(task);
    setActions([]);

    // Simulation des étapes MCP
    const steps = [
      {
        id: '1',
        type: 'analysis' as const,
        title: 'Analyse de la demande',
        description: 'L\'agent analyse votre demande avec IA',
        status: 'processing' as const
      },
      {
        id: '2',
        type: 'payment' as const,
        title: 'Création paiement Stripe',
        description: 'Intégration MCP Stripe pour traiter le paiement',
        status: 'pending' as const
      },
      {
        id: '3',
        type: 'email' as const,
        title: 'Envoi email SendGrid',
        description: 'Intégration MCP SendGrid pour notification',
        status: 'pending' as const
      },
      {
        id: '4',
        type: 'github' as const,
        title: 'Création issue GitHub',
        description: 'Intégration MCP GitHub pour suivi',
        status: 'pending' as const
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
      setActions(prev => prev.map(action =>
        action.id === step.id
          ? { ...action, status: 'completed' as const, result: getMockResult(step.type) }
          : action
      ));
    }

    setIsProcessing(false);
    setCurrentTask('');
  };

  const getMockResult = (type: string) => {
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

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'payment': return CreditCard;
      case 'email': return Mail;
      case 'github': return Github;
      default: return Bot;
    }
  };

  const getActionColor = (type: string) => {
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

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Bot className="w-7 h-7 text-purple-400" />
            Agent MCP - Démonstration
          </h1>
          <p className="text-gray-400">
            Exemple d&apos;agent utilisant Stripe, SendGrid et GitHub via outils MCP
          </p>
        </div>

        {/* Simulation banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-300 text-sm">Cette page est une <strong>démonstration interactive</strong>. Les résultats affichés sont simulés localement et ne déclenchent aucun appel API réel.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Panel gauche - Contrôles */}
          <div className="space-y-6">
            {/* Informations sur l'agent */}
            <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                Agent E-commerce Intelligent
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-green-400">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Stripe MCP - Gestion des paiements
                </div>
                <div className="flex items-center text-blue-400">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  SendGrid MCP - Envoi d'emails
                </div>
                <div className="flex items-center text-purple-400">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  GitHub MCP - Suivi des demandes
                </div>
              </div>
            </div>

            {/* Tâches de démonstration */}
            <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Tâches de démonstration</h3>
              <div className="space-y-3">
                {demoTasks.map((task, index) => (
                  <button
                    key={index}
                    onClick={() => executeAgentWithMCP(task.title)}
                    disabled={isProcessing}
                    className="w-full p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-pink-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div className="font-semibold text-white">{task.title}</div>
                    <div className="text-sm text-gray-400 mt-1">{task.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Status actuel */}
            {currentTask && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center text-blue-400">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  <span className="font-semibold">Traitement en cours...</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{currentTask}</p>
              </div>
            )}
          </div>

          {/* Panel droit - Journal des actions */}
          <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Journal des Actions MCP
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {actions.length === 0 && !isProcessing && (
                <div className="text-center text-gray-400 py-8">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Sélectionnez une tâche pour voir l'agent en action</p>
                </div>
              )}

              {actions.map((action) => {
                const Icon = getActionIcon(action.type);
                const colorClass = getActionColor(action.type);

                return (
                  <div key={action.id} className="p-4 bg-[#0f1020] rounded-lg border border-purple-500/10">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg bg-purple-500/20 ${colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white">{action.title}</h4>
                          <div className="flex items-center">
                            {action.status === 'processing' && (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                            )}
                            {action.status === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            )}
                            {action.status === 'failed' && (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{action.description}</p>

                        {action.result && action.status === 'completed' && (
                          <div className="mt-3 p-3 bg-[#0a0a14] rounded border border-purple-500/10">
                            <div className="text-xs text-gray-500 mb-2">Résultat MCP :</div>
                            <pre className="text-xs text-green-400 overflow-x-auto">
                              {JSON.stringify(action.result, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Code example */}
        <div className="mt-8 p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Code className="w-5 h-5 mr-2" />
            Exemple d'utilisation des outils MCP
          </h3>
          <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
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
  );
}
