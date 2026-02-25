// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { BookOpen, Code, Zap, CreditCard, Mail, Github, CheckCircle, ArrowRight, Copy, ExternalLink, Terminal, Globe, Shield } from 'lucide-react';

export default function MCPAgentGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copyToClipboard(text, id)}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
      title="Copier"
    >
      {copied === id ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-purple-400" />
            Guide MCP — Connexion aux LLMs
          </h1>
          <p className="text-gray-400">
            Connectez votre serveur TwinMCP à Claude, Cursor, Windsurf, VS Code et autres clients MCP
          </p>
        </div>

        {/* Quick Start — LLM Integration */}
        <div className="p-6 bg-[#1a1b2e] border border-green-500/30 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-green-400" />
            Connexion rapide aux LLMs
          </h2>
          <p className="text-gray-300 mb-6">
            Copiez la configuration correspondant à votre client LLM. Remplacez <code className="text-purple-400">YOUR_API_KEY</code> par votre clé API (<a href="/dashboard/api-keys" className="text-purple-400 underline hover:text-purple-300">obtenir une clé</a>).
          </p>

          <div className="space-y-6">
            {/* Claude Desktop */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-orange-400" />
                Claude Desktop
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                Fichier: <code className="text-gray-300">~/.config/claude/claude_desktop_config.json</code> (macOS/Linux) ou <code className="text-gray-300">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows)
              </p>
              <div className="relative">
                <CopyButton text={`{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`} id="claude-desktop" />
                <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="text-green-400">{`{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`}</code>
                </pre>
              </div>
            </div>

            {/* Claude Code */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-orange-400" />
                Claude Code (CLI)
              </h3>
              <div className="relative">
                <CopyButton text="claude mcp add twinmcp -- npx -y @twinmcp/mcp --api-key YOUR_API_KEY" id="claude-code" />
                <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="text-green-400">claude mcp add twinmcp -- npx -y @twinmcp/mcp --api-key YOUR_API_KEY</code>
                </pre>
              </div>
            </div>

            {/* Cursor */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-400" />
                Cursor
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                Fichier: <code className="text-gray-300">~/.cursor/mcp.json</code>
              </p>
              <div className="relative">
                <CopyButton text={`{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`} id="cursor" />
                <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="text-green-400">{`{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`}</code>
                </pre>
              </div>
            </div>

            {/* Windsurf */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                Windsurf
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                Fichier: <code className="text-gray-300">~/.codeium/windsurf/mcp_config.json</code>
              </p>
              <div className="relative">
                <CopyButton text={`{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`} id="windsurf" />
                <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="text-green-400">{`{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`}</code>
                </pre>
              </div>
            </div>

            {/* VS Code */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-500" />
                VS Code (GitHub Copilot)
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                Fichier: <code className="text-gray-300">.vscode/mcp.json</code> dans votre projet
              </p>
              <div className="relative">
                <CopyButton text={`{
  "servers": {
    "twinmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`} id="vscode" />
                <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="text-green-400">{`{
  "servers": {
    "twinmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@twinmcp/mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}`}</code>
                </pre>
              </div>
            </div>

            {/* HTTP — OpenAI / Gemini */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-400" />
                HTTP (OpenAI GPTs, Gemini, cURL)
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                Pour les clients HTTP, utilisez le endpoint Streamable HTTP :
              </p>
              <div className="relative">
                <CopyButton text={`curl -X POST https://YOUR_DOMAIN/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`} id="http" />
                <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="text-green-400">{`curl -X POST https://YOUR_DOMAIN/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol info */}
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Protocole et Transports
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-white mb-2">Streamable HTTP</h3>
              <p className="text-sm text-gray-400 mb-1"><code className="text-green-400">POST /api/mcp</code></p>
              <p className="text-xs text-gray-500">Claude Code, OpenAI, Gemini</p>
            </div>
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-white mb-2">SSE (Legacy)</h3>
              <p className="text-sm text-gray-400 mb-1"><code className="text-green-400">GET /api/mcp/sse</code></p>
              <p className="text-xs text-gray-500">Claude Desktop, Cursor, Windsurf</p>
            </div>
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-white mb-2">stdio</h3>
              <p className="text-sm text-gray-400 mb-1"><code className="text-green-400">npx @twinmcp/mcp</code></p>
              <p className="text-xs text-gray-500">Tous les clients locaux</p>
            </div>
          </div>
        </div>

        {/* Available tools */}
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Outils MCP disponibles</h2>
          <div className="space-y-4">
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-purple-400 mb-2">resolve-library-id</h3>
              <p className="text-sm text-gray-300 mb-2">Résout un nom de bibliothèque et retourne son identifiant TwinMCP.</p>
              <p className="text-xs text-gray-500">Params: <code>query</code> (string), <code>libraryName</code> (string)</p>
            </div>
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-purple-400 mb-2">query-docs</h3>
              <p className="text-sm text-gray-300 mb-2">Recherche la documentation d&apos;une bibliothèque spécifique. Retourne des snippets de code et des guides.</p>
              <p className="text-xs text-gray-500">Params: <code>libraryId</code> (string), <code>query</code> (string), <code>version</code>?, <code>maxResults</code>?, <code>maxTokens</code>?</p>
            </div>
          </div>
        </div>

        {/* Introduction (original section) */}
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Agent MCP — Exemple avancé</h2>
          <p className="text-gray-300 mb-4">
            Cet exemple montre comment créer un agent intelligent qui utilise plusieurs outils MCP
            (Model Context Protocol) pour automatiser des tâches complexes comme le traitement
            des paiements, l&apos;envoi d&apos;emails et la gestion des issues GitHub.
          </p>
          <div className="flex items-center text-green-400">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Démonstration interactive disponible : <a href="/dashboard/agent-mcp-demo" className="underline hover:text-green-300">Voir la démo</a></span>
          </div>
        </div>

        {/* Architecture */}
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Architecture MCP</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <CreditCard className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-bold text-white mb-2">Stripe MCP</h3>
              <p className="text-sm text-gray-400">Gestion des paiements, abonnements et factures</p>
            </div>
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <Mail className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-bold text-white mb-2">SendGrid MCP</h3>
              <p className="text-sm text-gray-400">Envoi d'emails transactionnels et marketing</p>
            </div>
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <Github className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="font-bold text-white mb-2">GitHub MCP</h3>
              <p className="text-sm text-gray-400">Gestion des repositories et issues</p>
            </div>
          </div>
        </div>

        {/* Exemple de code */}
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
            <Code className="w-6 h-6 mr-2" />
            Exemple d'implémentation
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">1. Configuration des outils MCP</h3>
              <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
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
              <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
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
              <pre className="bg-[#0a0a14] p-4 rounded-lg overflow-x-auto text-sm">
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
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
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
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Installation et configuration</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">1. Variables d'environnement</h3>
              <div className="bg-[#0a0a14] p-4 rounded-lg">
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
              <div className="bg-[#0a0a14] p-4 rounded-lg">
                <pre className="text-sm text-green-400">
{`npm install stripe @sendgrid/mail octokit
npm install --save-dev @types/node`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">3. Configuration des outils MCP</h3>
              <div className="bg-[#0a0a14] p-4 rounded-lg">
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
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Cas d'usage pratiques</h2>

          <div className="space-y-4">
            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-white mb-2">E-commerce automatisé</h3>
              <p className="text-sm text-gray-400 mb-3">
                L'agent traite automatiquement les commandes : paiement → email → suivi GitHub
              </p>
              <div className="flex items-center text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                Automatisation complète du processus de vente
              </div>
            </div>

            <div className="p-4 bg-[#0f1020] rounded-lg">
              <h3 className="font-bold text-white mb-2">Support client intelligent</h3>
              <p className="text-sm text-gray-400 mb-3">
                Analyse des demandes clients et création automatique d'issues GitHub
              </p>
              <div className="flex items-center text-blue-400 text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                Suivi automatique des demandes support
              </div>
            </div>

            <div className="p-4 bg-[#0f1020] rounded-lg">
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
        <div className="p-6 bg-[#1a1b2e] border border-purple-500/20 rounded-xl">
          <h2 className="text-2xl font-bold text-white mb-4">Ressources et documentation</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="https://docs.stripe.com/api"
              className="p-4 bg-[#0f1020] rounded-lg hover:bg-purple-500/10 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-green-400" />
              <div>
                <div className="font-bold text-white">Documentation Stripe</div>
                <div className="text-sm text-gray-400">API officielle Stripe</div>
              </div>
            </a>

            <a
              href="https://docs.sendgrid.com/api-reference"
              className="p-4 bg-[#0f1020] rounded-lg hover:bg-purple-500/10 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-blue-400" />
              <div>
                <div className="font-bold text-white">Documentation SendGrid</div>
                <div className="text-sm text-gray-400">API email officielle</div>
              </div>
            </a>

            <a
              href="https://docs.github.com/rest"
              className="p-4 bg-[#0f1020] rounded-lg hover:bg-purple-500/10 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-purple-400" />
              <div>
                <div className="font-bold text-white">Documentation GitHub</div>
                <div className="text-sm text-gray-400">API REST GitHub</div>
              </div>
            </a>

            <a
              href="/dashboard/library"
              className="p-4 bg-[#0f1020] rounded-lg hover:bg-purple-500/10 transition flex items-center"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-orange-400" />
              <div>
                <div className="font-bold text-white">Bibliothèques MCP</div>
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
              href="/dashboard/library"
              className="px-6 py-3 bg-[#1a1b2e] border border-purple-500/20 text-white font-semibold rounded-lg hover:bg-purple-500/10 transition flex items-center"
            >
              Explorer les bibliothèques
            </a>
          </div>
        </div>
    </div>
  );
}
