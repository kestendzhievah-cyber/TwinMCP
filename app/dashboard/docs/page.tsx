'use client';

import React, { useState } from 'react';
import { ChevronRight, Search, Book, Code, Settings, Users, Shield, Terminal, Database, Globe, Lock, Key, GitBranch, BarChart, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { cn } from '../../../lib/utils';
import Link from 'next/link';

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const sections = [
    {
      title: 'Démarrage',
      icon: <Book className="w-5 h-5" />,
      items: [
        { title: 'Installation', href: '/dashboard/docs/installation', icon: <Terminal className="w-4 h-4" /> },
        { title: 'Guide API', href: '/dashboard/docs/api-guide', icon: <Code className="w-4 h-4" /> },
        { title: 'Dépannage', href: '/dashboard/docs/troubleshooting', icon: <AlertCircle className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Dashboard',
      icon: <Settings className="w-5 h-5" />,
      items: [
        { title: 'Gérer les Clés API', href: '/dashboard/api-keys', icon: <Key className="w-4 h-4" /> },
        { title: 'Bibliothèques', href: '/dashboard/library', icon: <Database className="w-4 h-4" /> },
        { title: 'Serveurs MCP Externes', href: '/dashboard/external-mcp', icon: <Globe className="w-4 h-4" /> },
        { title: 'Paramètres', href: '/dashboard/settings', icon: <Settings className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Guides Avancés',
      icon: <Code className="w-5 h-5" />,
      items: [
        { title: 'Guide Agent MCP', href: '/dashboard/mcp-guide', icon: <Code className="w-4 h-4" /> },
        { title: 'Démo Agent MCP', href: '/dashboard/agent-mcp-demo', icon: <Zap className="w-4 h-4" /> },
        { title: 'Créer un Chatbot', href: '/dashboard/create-chatbot', icon: <Users className="w-4 h-4" /> },
      ]
    },
  ];

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
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
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Rechercher dans la documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[#1a1a2e] border border-purple-700/30 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
        />
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-fuchsia-400" />
          <h2 className="text-xl font-semibold text-fuchsia-300">Démarrage Rapide</h2>
        </div>
        <p className="text-gray-300 mb-4">
          Nouveau sur TwinMCP ? Commencez par installer votre premier serveur MCP.
        </p>
        <Link
          href="/dashboard/docs/installation"
          className="inline-flex items-center gap-2 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg transition-colors"
        >
          Commencer <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Documentation Sections */}
      <div className="grid gap-8">
        {filteredSections.map((section, index) => (
          <div key={index} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
                {section.icon}
              </div>
              <h2 className="text-2xl font-semibold text-gray-100">{section.title}</h2>
            </div>
            
            <div className="grid gap-3">
              {section.items.map((item, itemIndex) => (
                <Link
                  key={itemIndex}
                  href={item.href}
                  className="flex items-center gap-4 p-4 bg-[#1a1a2e] border border-purple-700/30 rounded-lg hover:border-fuchsia-500/50 hover:bg-[#252542] transition-all group"
                >
                  <div className="p-2 bg-purple-600/10 rounded-lg text-purple-400 group-hover:text-fuchsia-400 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-gray-100 font-medium group-hover:text-fuchsia-300 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-fuchsia-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Help Section */}
      <div className="text-center space-y-4 pt-8 border-t border-purple-700/30">
        <h3 className="text-xl font-semibold text-gray-100">Besoin d'aide ?</h3>
        <p className="text-gray-400">
          Notre équipe est là pour vous aider à configurer votre serveur MCP.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/dashboard/docs/troubleshooting"
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Centre d'aide
          </Link>
          <Link
            href="/dashboard/docs/api-guide"
            className="px-6 py-3 border border-purple-600 hover:bg-purple-600/20 text-purple-400 rounded-lg transition-colors"
          >
            Documentation API
          </Link>
        </div>
      </div>
    </div>
  );
}
