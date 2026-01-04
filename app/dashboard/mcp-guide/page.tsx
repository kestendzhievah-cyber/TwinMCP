import React from 'react';
import { BookOpen, Code, Zap, CreditCard, Mail, Github, CheckCircle, ArrowRight, Copy, ExternalLink } from 'lucide-react';

export default function MCPAgentGuide() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Vous pourriez ajouter une notification ici
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
            <BookOpen className="w-10 h-10 mr-3 text-purple-400" />
            Guide - Agent MCP Complet
          </h1>
          <p className="text-gray-400">
            Tutoriel complet pour créer et utiliser un agent avec outils MCP
          </p>
        </div>

        {/* Introduction */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
          <p className="text-gray-300 mb-4">
            Cet exemple montre comment créer un agent intelligent qui utilise plusieurs outils MCP
            (Model Context Protocol) pour automatiser des tâches complexes comme le traitement
            des paiements, l'envoi d'emails et la gestion des issues GitHub.
          </p>
          <div className="flex items-center text-green-400">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Démonstration interactive disponible : <a href="/dashboard/agent-mcp-demo" className="underline hover:text-green-300">Voir la démo</a></span>
          </div>
        </div>

        {/* Architecture */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Architecture MCP</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <CreditCard className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-bold text-white mb-2">Stripe MCP</h3>
              <p className="text-sm text-gray-400">Gestion des paiements, abonnements et factures</p>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <Mail className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-bold text-white mb-2">SendGrid MCP</h3>
              <p className="text-sm text-gray-400">Envoi d'emails transactionnels et marketing</p>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <Github className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="font-bold text-white mb-2">GitHub MCP</h3>
              <p className="text-sm text-gray-400">Gestion des repositories et issues</p>
            </div>
          </div>
        </div>

        {/* Exemple de code */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
            <Code className="w-6 h-6 mr-2" />
            Exemple d'implémentation
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">1. Configuration des outils MCP</h3>
              <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="text-green-400">{`// Configuration des outils MCP
const mcpTools = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: 'noreply@votreentreprise.com'
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    repo: 'votre-entreprise/support'
  }
};`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">2. Création de l'agent</h3>
              <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="text-green-400">{`// Agent avec outils MCP intégrés
class EcommerceAgent {
  constructor(mcpTools) {
    this.stripe = new StripeMCP(mcpTools.stripe);
    this.sendgrid = new SendGridMCP(mcpTools.sendgrid);
    this.github = new GitHubMCP(mcpTools.github);
  }

  async processOrder(orderData) {
    // 1. Créer le paiement
    const payment = await this.stripe.createPayment({
      amount: orderData.amount,
      currency: 'eur',
      customer: orderData.customer
    });

    // 2. Envoyer l'email de confirmation
    await this.sendgrid.sendEmail({
      to: orderData.customer,
      template: 'order_confirmation',
      data: { order: orderData, payment }
    });

    // 3. Créer une issue GitHub pour le suivi
    await this.github.createIssue({
      title: \`Commande \${orderData.id}\`,
      body: \`Nouveau paiement: \${payment.id}\`,
      labels: ['order', 'payment']
    });

    return { payment, email: 'sent', issue: 'created' };
  }
}`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">3. Utilisation de l'agent</h3>
              <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="text-green-400">{`// Utilisation de l'agent
const agent = new EcommerceAgent(mcpTools);

const result = await agent.processOrder({
  id: 'CMD-001',
  customer: 'client@example.com',
  amount: 29.99,
  items: ['Service Premium']
});

console.log('Commande traitée:', result);
// Output:
// {
//   payment: { id: 'pi_xxx', status: 'succeeded' },
//   email: 'sent',
//   issue: { number: 123, url: 'https://github.com/.../issues/123' }
// }`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Fonctionnalités disponibles */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Fonctionnalités disponibles</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Stripe MCP
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Création de paiements et charges</li>
                <li>• Gestion des abonnements</li>
                <li>• Création de factures</li>
                <li>• Gestion des clients</li>
                <li>• Webhooks pour événements</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                SendGrid MCP
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Envoi d'emails personnalisés</li>
                <li>• Templates d'email</li>
                <li>• Tracking des ouvertures</li>
                <li>• Gestion des listes de contacts</li>
                <li>• Analytics des emails</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center">
                <Github className="w-5 h-5 mr-2" />
                GitHub MCP
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Création d'issues</li>
                <li>• Gestion des repositories</li>
                <li>• Commentaires sur issues</li>
                <li>• Gestion des labels</li>
                <li>• Webhooks GitHub</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-orange-400 mb-3 flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                Agent IA
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Analyse des demandes clients</li>
                <li>• Orchestration des outils MCP</li>
                <li>• Gestion des erreurs</li>
                <li>• Logging des actions</li>
                <li>• Interface utilisateur intuitive</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Guide d'installation */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Installation et configuration</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">1. Variables d'environnement</h3>
              <div className="bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm text-gray-300">
{`# Fichier .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....
GITHUB_TOKEN=ghp_...`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">2. Installation des dépendances</h3>
              <div className="bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm text-green-400">
{`npm install stripe @sendgrid/mail octokit
npm install --save-dev @types/node`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">3. Configuration des outils MCP</h3>
              <div className="bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm text-green-400">
{`// lib/mcp-tools.ts
export const loadMCPTools = async () => {
  return {
    stripe: await initStripeMCP(),
    sendgrid: await initSendGridMCP(),
    github: await initGitHubMCP()
  };
};`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Cas d'usage */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Cas d'usage pratiques</h2>

          <div className="space-y-4">
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <h3 className="font-bold text-white mb-2">E-commerce automatisé</h3>
              <p className="text-sm text-gray-400 mb-3">
                L'agent traite automatiquement les commandes : paiement → email → suivi GitHub
              </p>
              <div className="flex items-center text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                Automatisation complète du processus de vente
              </div>
            </div>

            <div className="p-4 bg-slate-700/50 rounded-lg">
              <h3 className="font-bold text-white mb-2">Support client intelligent</h3>
              <p className="text-sm text-gray-400 mb-3">
                Analyse des demandes clients et création automatique d'issues GitHub
              </p>
              <div className="flex items-center text-blue-400 text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                Suivi automatique des demandes support
              </div>
            </div>

            <div className="p-4 bg-slate-700/50 rounded-lg">
              <h3 className="font-bold text-white mb-2">Marketing automation</h3>
              <p className="text-sm text-gray-400 mb-3">
                Envoi automatique d'emails de bienvenue et suivi des interactions
              </p>
              <div className="flex items-center text-purple-400 text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                Campagnes marketing personnalisées
              </div>
            </div>
          </div>
        </div>

        {/* Ressources */}
        <div className="p-6 bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-xl">
          <h2 className="text-2xl font-bold text-white mb-4">Ressources et documentation</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="https://docs.stripe.com/api"
              className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-green-400" />
              <div>
                <div className="font-bold text-white">Documentation Stripe</div>
                <div className="text-sm text-gray-400">API officielle Stripe</div>
              </div>
            </a>

            <a
              href="https://docs.sendgrid.com/api-reference"
              className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-blue-400" />
              <div>
                <div className="font-bold text-white">Documentation SendGrid</div>
                <div className="text-sm text-gray-400">API email officielle</div>
              </div>
            </a>

            <a
              href="https://docs.github.com/rest"
              className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-purple-400" />
              <div>
                <div className="font-bold text-white">Documentation GitHub</div>
                <div className="text-sm text-gray-400">API REST GitHub</div>
              </div>
            </a>

            <a
              href="/dashboard/marketplace"
              className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-orange-400" />
              <div>
                <div className="font-bold text-white">Marketplace MCP</div>
                <div className="text-sm text-gray-400">Découvrez plus d'outils</div>
              </div>
            </a>
          </div>
        </div>

        {/* Call to action */}
        <div className="p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Prêt à créer votre agent ?</h2>
          <p className="text-gray-300 mb-6">
            Testez l'exemple complet et commencez à construire votre propre agent avec outils MCP
          </p>
          <div className="flex items-center justify-center space-x-4">
            <a
              href="/dashboard/agent-mcp-demo"
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition flex items-center"
            >
              <Zap className="w-5 h-5 mr-2" />
              Voir la démonstration
            </a>
            <a
              href="/dashboard/marketplace"
              className="px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition flex items-center"
            >
              Explorer la marketplace
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
