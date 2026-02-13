'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Sparkles, ArrowLeft, BookOpen, Settings, Github, Globe, Download, Users,
  Clock, CheckCircle, ExternalLink, Copy, Terminal, Zap, Database, Cloud,
  Search, MessageSquare, BarChart3, FileText, CreditCard, Cpu, Ship, Box, Star, Code, Play
} from 'lucide-react';
import { toolsData } from '@/lib/mcp-tools-data';

const getIcon = (toolId: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    '1': <Cloud className="w-8 h-8" />, '2': <Cloud className="w-8 h-8" />,
    '3': <Search className="w-8 h-8" />, '4': <Database className="w-8 h-8" />,
    '5': <Sparkles className="w-8 h-8" />, '6': <Cloud className="w-8 h-8" />,
    '7': <Search className="w-8 h-8" />, '8': <Sparkles className="w-8 h-8" />,
    '9': <BookOpen className="w-8 h-8" />, '10': <Sparkles className="w-8 h-8" />,
    '11': <Database className="w-8 h-8" />, '12': <Database className="w-8 h-8" />,
    '13': <Database className="w-8 h-8" />, '14': <Database className="w-8 h-8" />,
    '15': <Database className="w-8 h-8" />, '16': <Terminal className="w-8 h-8" />,
    '17': <Box className="w-8 h-8" />, '18': <Github className="w-8 h-8" />,
    '19': <Play className="w-8 h-8" />, '20': <Cloud className="w-8 h-8" />,
    '21': <BarChart3 className="w-8 h-8" />, '22': <MessageSquare className="w-8 h-8" />,
    '23': <FileText className="w-8 h-8" />, '24': <CreditCard className="w-8 h-8" />,
    '25': <Globe className="w-8 h-8" />, '26': <Cpu className="w-8 h-8" />,
    '27': <BookOpen className="w-8 h-8" />, '28': <Ship className="w-8 h-8" />,
    '29': <Zap className="w-8 h-8" />, '30': <Clock className="w-8 h-8" />,
  };
  return iconMap[toolId] || <Sparkles className="w-8 h-8" />;
};

export default function ToolDetailPage() {
  const params = useParams();
  const toolId = params.id as string;
  const tool = useMemo(() => toolsData[toolId], [toolId]);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!tool) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-white mb-4">Outil non trouvé</h1>
        <Link href="/dashboard" className="text-purple-400 hover:text-purple-300">Retour au dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm">
        <ArrowLeft className="w-4 h-4" />
        Retour au dashboard
      </Link>

        {/* En-tête */}
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6 lg:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${tool.iconBg} flex items-center justify-center flex-shrink-0`}>
              {getIcon(toolId)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-white">{tool.name}</h1>
                {tool.isOfficial && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-medium rounded-full">
                    <CheckCircle className="w-3 h-3" />Officiel
                  </span>
                )}
                <span className="px-2 py-1 bg-[#0f1020] text-gray-400 text-xs font-medium rounded-full">{tool.category}</span>
              </div>
              <p className="text-gray-400 mb-4">par <span className="text-purple-400">@{tool.author}</span></p>
              <p className="text-gray-300 text-lg mb-6">{tool.longDescription}</p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-gray-400"><Download className="w-5 h-5" /><span>{tool.downloads} téléchargements</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Users className="w-5 h-5" /><span>{tool.users} utilisateurs</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Clock className="w-5 h-5" /><span>Mis à jour il y a {tool.lastUpdate}</span></div>
                <div className="flex items-center gap-2 text-gray-400"><Star className="w-5 h-5" /><span>v{tool.version}</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <a href={tool.repository} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-[#0f1020] border border-purple-500/20 rounded-lg text-gray-300 hover:text-white hover:border-purple-500/50 transition">
                <Github className="w-5 h-5" />Repository<ExternalLink className="w-4 h-4" />
              </a>
              <a href={tool.documentation} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-[#0f1020] border border-purple-500/20 rounded-lg text-gray-300 hover:text-white hover:border-purple-500/50 transition">
                <BookOpen className="w-5 h-5" />Documentation<ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Installation */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-400" />Installation
              </h2>
              <div className="relative">
                <pre className="bg-[#0f1020] rounded-lg p-4 overflow-x-auto"><code className="text-green-400">{tool.installation}</code></pre>
                <button onClick={() => copyToClipboard(tool.installation, 'install')} className="absolute top-2 right-2 p-2 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition">
                  {copied === 'install' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-400" />Configuration
              </h2>
              <p className="text-gray-400 mb-4">Ajoutez cette configuration à votre fichier <code className="text-purple-400">claude_desktop_config.json</code> :</p>
              <div className="relative">
                <pre className="bg-[#0f1020] rounded-lg p-4 overflow-x-auto text-sm"><code className="text-blue-300">{tool.configuration}</code></pre>
                <button onClick={() => copyToClipboard(tool.configuration, 'config')} className="absolute top-2 right-2 p-2 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition">
                  {copied === 'config' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Exemples */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-purple-400" />Exemples d'utilisation
              </h2>
              <div className="space-y-4">
                {tool.examples.map((example, index) => (
                  <div key={index} className="bg-[#0f1020] rounded-lg p-4">
                    <h3 className="text-white font-medium mb-2">{example.title}</h3>
                    <p className="text-gray-400 text-sm italic">"{example.code}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Fonctionnalités */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Fonctionnalités</h2>
              <ul className="space-y-3">
                {tool.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Infos */}
            <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Informations</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Version</span><span className="text-white">{tool.version}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Auteur</span><span className="text-purple-400">@{tool.author}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Catégorie</span><span className="text-white">{tool.category}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Mise à jour</span><span className="text-white">Il y a {tool.lastUpdate}</span></div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
