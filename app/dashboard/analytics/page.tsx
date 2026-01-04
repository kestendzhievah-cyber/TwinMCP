"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, Activity, BarChart3, PieChart, Users, DollarSign, Clock, Target, ArrowUpRight, ArrowDownRight, Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [isHovered, setIsHovered] = useState(false);

  const analyticsData = {
    overview: [
      {
        title: "Conversations Totales",
        value: "24,573",
        change: "+12.5%",
        trend: "up",
        icon: Users,
        color: "blue"
      },
      {
        title: "Taux de Réussite",
        value: "94.2%",
        change: "+2.1%",
        trend: "up",
        icon: Target,
        color: "green"
      },
      {
        title: "Temps Moyen",
        value: "2m 34s",
        change: "-8.3%",
        trend: "down",
        icon: Clock,
        color: "purple"
      },
      {
        title: "Coût Total",
        value: "€1,247",
        change: "-15.2%",
        trend: "down",
        icon: DollarSign,
        color: "pink"
      }
    ],
    chartData: [
      { name: "Lun", conversations: 2400, satisfaction: 94 },
      { name: "Mar", conversations: 1398, satisfaction: 92 },
      { name: "Mer", conversations: 9800, satisfaction: 96 },
      { name: "Jeu", conversations: 3908, satisfaction: 93 },
      { name: "Ven", conversations: 4800, satisfaction: 95 },
      { name: "Sam", conversations: 3800, satisfaction: 91 },
      { name: "Dim", conversations: 4300, satisfaction: 94 }
    ],
    topAgents: [
      { name: "Agent Support", conversations: 8750, satisfaction: 96.2, status: "active" },
      { name: "Agent Commercial", conversations: 6230, satisfaction: 94.8, status: "active" },
      { name: "Agent Qualification", conversations: 4590, satisfaction: 93.1, status: "paused" }
    ]
  };

  const getNeonGlow = (color: string) => {
    switch (color) {
      case "blue": return "0 6px 30px rgba(14,165,233,0.22)";
      case "green": return "0 6px 30px rgba(16,185,129,0.18)";
      case "purple": return "0 6px 30px rgba(139,92,246,0.28)";
      case "pink": return "0 6px 30px rgba(236,72,153,0.18)";
      default: return "0 6px 30px rgba(139,92,246,0.28)";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d17] to-[#1a0b2e] text-white">
      {/* Navigation Header */}
      <nav className="border-b border-purple-700/30 bg-[#0e0e16]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#8b5cf6]/40 to-[#ef4d95]/25 border border-[#8b5cf6]/30"
                   style={{ boxShadow: "0 6px 30px rgba(139,92,246,0.18)" }}>
                <Activity className="w-5 h-5 text-[#ef4d95]" />
              </div>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-400">
                Corel.IA Analytics
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm backdrop-blur-sm"
              >
                <option value="24h">24 heures</option>
                <option value="7d">7 jours</option>
                <option value="30d">30 jours</option>
                <option value="90d">90 jours</option>
              </select>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Analytics & Performance</h1>
          <p className="text-white/60">Analysez les performances de vos agents IA en temps réel</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {analyticsData.overview.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="p-6 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-white/6 backdrop-blur-lg relative overflow-hidden hover:scale-[1.02] transition-transform"
                   style={{ boxShadow: getNeonGlow(item.color) }}>
                <div className="absolute -left-10 -top-10 w-52 h-52 rounded-full opacity-10 bg-gradient-to-br from-[#8b5cf6] to-[#ef4d95] blur-3xl" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/6 border border-white/6"
                         style={{ boxShadow: getNeonGlow(item.color) }}>
                      <Icon className={`w-6 h-6 text-${item.color === 'blue' ? '[#0ea5e9]' : item.color === 'green' ? '[#10b981]' : item.color === 'purple' ? '[#8b5cf6]' : '[#ec4899]'}`} />
                    </div>
                    <div>
                      <div className="text-sm text-white/60">{item.title}</div>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </div>
                  </div>
                  <div className={`text-sm ${item.trend === 'up' ? 'text-green-400' : 'text-red-400'} flex items-center gap-1`}>
                    {item.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span>{item.change}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Conversations Chart */}
          <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur"
               style={{ boxShadow: getNeonGlow('blue') }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Évolution des Conversations</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-sm text-white/60">Conversations</span>
                <div className="w-3 h-3 bg-purple-400 rounded-full ml-2"></div>
                <span className="text-sm text-white/60">Satisfaction</span>
              </div>
            </div>
            <div className="h-64 rounded-lg bg-gradient-to-br from-black/20 to-black/10 border border-white/5 flex items-center justify-center">
              <div className="text-center text-white/30">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Graphique des conversations</p>
                <p className="text-sm">(à intégrer avec Chart.js/Recharts)</p>
              </div>
            </div>
          </div>

          {/* Performance Chart */}
          <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur"
               style={{ boxShadow: getNeonGlow('green') }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Performance par Agent</h3>
              <button className="text-sm text-white/60 hover:text-white">Détails</button>
            </div>
            <div className="space-y-4">
              {analyticsData.topAgents.map((agent, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/6">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${agent.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                    <div>
                      <div className="font-semibold">{agent.name}</div>
                      <div className="text-sm text-white/60">{agent.conversations.toLocaleString()} conversations</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-400">{agent.satisfaction}%</div>
                    <div className="text-sm text-white/60">satisfaction</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Response Time */}
          <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur"
               style={{ boxShadow: getNeonGlow('purple') }}>
            <h3 className="text-lg font-bold mb-4">Temps de Réponse Moyen</h3>
            <div className="text-3xl font-bold mb-2">1.8s</div>
            <div className="text-sm text-green-400 mb-4">↓ -0.3s vs semaine dernière</div>
            <div className="h-32 rounded-lg bg-gradient-to-br from-black/20 to-black/10 border border-white/5 flex items-center justify-center">
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
          </div>

          {/* Success Rate */}
          <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur"
               style={{ boxShadow: getNeonGlow('green') }}>
            <h3 className="text-lg font-bold mb-4">Taux de Réussite</h3>
            <div className="text-3xl font-bold mb-2">94.2%</div>
            <div className="text-sm text-green-400 mb-4">↑ +2.1% vs semaine dernière</div>
            <div className="h-32 rounded-lg bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-500/20 flex items-center justify-center">
              <Target className="w-8 h-8 text-green-400" />
            </div>
          </div>

          {/* Cost Analysis */}
          <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur"
               style={{ boxShadow: getNeonGlow('pink') }}>
            <h3 className="text-lg font-bold mb-4">Analyse des Coûts</h3>
            <div className="text-3xl font-bold mb-2">€0.04</div>
            <div className="text-sm text-green-400 mb-4">↓ -15.2% coût par conversation</div>
            <div className="h-32 rounded-lg bg-gradient-to-br from-pink-900/20 to-pink-800/10 border border-pink-500/20 flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-pink-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
