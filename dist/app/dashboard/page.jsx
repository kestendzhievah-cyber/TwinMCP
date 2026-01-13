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
exports.default = DashboardNeon;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
function DashboardNeon() {
    const [agents] = (0, react_1.useState)([
        { id: "1", name: "Agent Support Client", status: "active", conversations: 1247, cost: 28.5, satisfaction: 4.8, lastActivity: "2 min ago", type: "support" },
        { id: "2", name: "Agent Commercial", status: "active", conversations: 843, cost: 19.2, satisfaction: 4.6, lastActivity: "15 min ago", type: "sales" },
        { id: "3", name: "Agent Qualification", status: "paused", conversations: 521, cost: 12.8, satisfaction: 4.9, lastActivity: "1h ago", type: "qualification" },
    ]);
    const [userPlan] = (0, react_1.useState)({
        name: "Professional",
        agentsUsed: 3,
        agentsLimit: 5,
        conversationsUsed: 2611,
        conversationsLimit: 10000,
        cost: 60.5,
    });
    const stats = [
        { icon: lucide_react_1.Bot, label: "Agents Actifs", value: `${userPlan.agentsUsed}/${userPlan.agentsLimit}`, trend: "+2 ce mois", trendUp: true, color: "violet" },
        { icon: lucide_react_1.MessageSquare, label: "Conversations", value: userPlan.conversationsUsed.toLocaleString(), trend: `${((userPlan.conversationsUsed / userPlan.conversationsLimit) * 100).toFixed(1)}% utilisé`, trendUp: false, color: "blue" },
        { icon: lucide_react_1.DollarSign, label: "Coût Total", value: `${userPlan.cost.toFixed(2)}€`, trend: "-12% vs mois dernier", trendUp: true, color: "green" },
        { icon: lucide_react_1.TrendingUp, label: "Satisfaction", value: "4.77/5", trend: "+0.3 ce mois", trendUp: true, color: "pink" },
    ];
    const quickActions = [
        { icon: lucide_react_1.Plus, title: "Nouveau Template", description: "Démarrez depuis un template", href: "/dashboard/templates" },
        { icon: lucide_react_1.BarChart3, title: "Voir Analytics", description: "Explorer les performances", href: "/dashboard/analytics" },
        { icon: lucide_react_1.Zap, title: "Optimiser", description: "Réduire les coûts", href: "/dashboard/optimize" },
    ];
    // Variables CSS dynamiques basées sur les données
    const dynamicStyles = {
        backgroundOpacity: userPlan.agentsUsed / userPlan.agentsLimit > 0.8 ? 8 : 3,
        borderOpacity: userPlan.agentsUsed / userPlan.agentsLimit > 0.8 ? 15 : 6,
        glowIntensity: userPlan.agentsUsed / userPlan.agentsLimit > 0.8 ? 0.35 : 0.25,
        primaryColor: userPlan.agentsUsed >= userPlan.agentsLimit * 0.9 ? '#10b981' : '#8b5cf6',
        secondaryColor: userPlan.cost < 50 ? '#06b6d4' : '#ec4899'
    };
    // Fonction pour générer une classe CSS basée sur les données
    const generateSectionClass = (sectionName) => {
        const hash = btoa(sectionName + JSON.stringify(userPlan)).slice(0, 16);
        return `jsx-${hash} mb-8`;
    };
    // Fonction pour générer des styles CSS personnalisés
    const generateCardClass = (agentId) => {
        const agent = agents.find(a => a.id === agentId);
        if (!agent)
            return '';
        const hash = btoa(agentId + agent.name + agent.status).slice(0, 16);
        return `jsx-card-${hash}`;
    };
    const neonGlow = (color) => {
        switch (color) {
            case "violet":
                return "0 6px 30px rgba(139,92,246,0.28), 0 0 30px rgba(219,39,119,0.08)";
            case "blue":
                return "0 6px 30px rgba(14,165,233,0.22), 0 0 20px rgba(59,130,246,0.08)";
            case "green":
                return "0 6px 30px rgba(16,185,129,0.18)";
            default:
                return "0 6px 30px rgba(139,92,246,0.28)";
        }
    };
    return (<div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d17] to-[#1a0b2e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-8 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Tableau de Bord</h1>
          <p className="text-sm text-white/50">Gérez et optimisez vos agents IA — style néon</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input placeholder="Rechercher..." className="bg-white/6 placeholder:text-white/40 rounded-lg px-4 py-2 pr-10 outline-none w-64 backdrop-blur-sm border border-white/6"/>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50">⌕</div>
          </div>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#ef4d95] font-semibold shadow-lg" style={{ boxShadow: "0 10px 40px rgba(239,77,149,0.18)" }}>
            <lucide_react_1.Plus className="w-4 h-4 inline mr-2"/>
            Créer
          </button>
        </div>
      </div>

      <div className="px-8">

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (<div key={i} className="p-6 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-white/6 backdrop-blur-lg relative overflow-hidden hover:scale-[1.02] transition-transform" style={{ boxShadow: neonGlow(s.color) }}>
                <div className="absolute -left-10 -top-10 w-52 h-52 rounded-full opacity-10 bg-gradient-to-br from-[#8b5cf6] to-[#ef4d95] blur-3xl"/>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/6 border border-white/6" style={{ boxShadow: neonGlow(s.color) }}>
                      <Icon className={`w-6 h-6 text-${s.color === 'blue' ? '[#0ea5e9]' : '[#8b5cf6]'}`}/>
                    </div>
                    <div>
                      <div className="text-sm text-white/60">{s.label}</div>
                      <div className="text-2xl font-bold">{s.value}</div>
                    </div>
                  </div>
                  <div className={`text-sm ${s.trendUp ? 'text-green-400' : 'text-white/50'} flex items-center gap-1`}>
                    {s.trendUp ? <lucide_react_1.ArrowUpRight className="w-4 h-4"/> : <lucide_react_1.ArrowDownRight className="w-4 h-4"/>}
                    <span className="text-xs">{s.trend}</span>
                  </div>
                </div>
              </div>);
        })}
        </section>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Large panel */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur relative" style={{ boxShadow: neonGlow('violet') }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Utilisation & Performance</h2>
              <div className="text-sm text-white/50">Dernières 24h</div>
            </div>

            <div className="h-80 rounded-lg bg-gradient-to-br from-black/20 to-black/10 border border-white/5 flex items-center justify-center text-white/30 relative overflow-hidden group">
              {/* Full-width Dynamic Chart */}
              <div className="w-full h-full p-6 relative">
                <svg viewBox="0 0 420 240" className="w-full h-full">
                  {/* Enhanced background with better grid */}
                  <defs>
                    <pattern id="full-grid" width="42" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 42 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6"/>
                    </pattern>
                    <linearGradient id="full-bar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.95"/>
                      <stop offset="50%" stopColor="#ec4899" stopOpacity="0.85"/>
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.75"/>
                    </linearGradient>
                    <filter id="full-glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Full-width grid background */}
                  <rect width="420" height="240" fill="url(#full-grid)"/>

                  {/* Larger chart area */}
                  <rect x="45" y="35" width="350" height="170" fill="rgba(139,92,246,0.04)" stroke="rgba(139,92,246,0.12)" strokeWidth="1.5" rx="8"/>

                  {/* Chart title */}
                  <text x="60" y="30" className="fill-white/90 text-base font-semibold">Performance des Agents - Analyse Détaillée</text>

                  {/* Enhanced Y-axis scale with more levels */}
                  {[
            { value: Math.max(...agents.map(a => a.conversations)), pos: 45 },
            { value: Math.max(...agents.map(a => a.conversations)) * 0.85, pos: 75 },
            { value: Math.max(...agents.map(a => a.conversations)) * 0.7, pos: 105 },
            { value: Math.max(...agents.map(a => a.conversations)) * 0.55, pos: 135 },
            { value: Math.max(...agents.map(a => a.conversations)) * 0.4, pos: 165 },
            { value: Math.max(...agents.map(a => a.conversations)) * 0.25, pos: 195 }
        ].map((scale, i) => (<g key={i}>
                      <line x1="45" y1={scale.pos} x2="395" y2={scale.pos} stroke="rgba(255,255,255,0.06)" strokeWidth="0.8"/>
                      <text x="35" y={scale.pos + 5} textAnchor="middle" className="fill-white/50 text-sm font-medium">
                        {Math.round(scale.value)}
                      </text>
                    </g>))}

                  {/* Enhanced bars with more space */}
                  {agents.map((agent, i) => {
            const x = 90 + (i * 100);
            const maxConversations = Math.max(...agents.map(a => a.conversations));
            const barHeight = (agent.conversations / maxConversations) * 140;
            const y = 205 - barHeight;
            return (<g key={i} className="group">
                        {/* Agent label */}
                        <text x={x} y="220" textAnchor="middle" className="fill-white/70 text-sm font-medium group-hover:fill-white transition-colors">
                          {agent.name.split(' ')[0]}
                        </text>

                        {/* Enhanced bar */}
                        <rect x={x - 25} y={y} width="50" height={barHeight} fill="url(#full-bar-gradient)" rx="6" filter="url(#full-glow)" className="cursor-pointer transition-all duration-300 hover:scale-105 hover:brightness-110" opacity="0.9"/>

                        {/* Value display */}
                        <text x={x} y={y - 10} textAnchor="middle" className="fill-white text-base font-bold drop-shadow-lg">
                          {agent.conversations.toLocaleString()}
                        </text>

                        {/* Enhanced agent icon */}
                        <circle cx={x} cy={y - 30} r="15" fill={agent.type === 'support' ? '#0ea5e9' : agent.type === 'sales' ? '#10b981' : '#8b5cf6'} className="cursor-pointer transition-all duration-300 hover:scale-110 hover:brightness-125" filter="url(#full-glow)"/>
                        <text x={x} y={y - 25} textAnchor="middle" className="fill-white text-base font-bold pointer-events-none">
                          {agent.name.charAt(0)}
                        </text>

                        {/* Enhanced tooltip */}
                        <rect x={x - 35} y={y - 75} width="70" height="45" fill="rgba(0,0,0,0.85)" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" rx="6" className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"/>
                        <text x={x} y={y - 60} textAnchor="middle" className="fill-white text-sm font-semibold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {agent.name}
                        </text>
                        <text x={x} y={y - 45} textAnchor="middle" className="fill-cyan-400 text-sm font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {agent.conversations.toLocaleString()} conv.
                        </text>
                        <text x={x} y={y - 35} textAnchor="middle" className="fill-green-400 text-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {agent.satisfaction}/5 satisfaction
                        </text>
                      </g>);
        })}

                  {/* Enhanced trend indicator */}
                  <g>
                    <rect x="320" y="15" width="90" height="15" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.35)" strokeWidth="1" rx="7"/>
                    <circle cx="327" cy="22.5" r="4" fill="#10b981"/>
                    <text x="340" y="27" className="fill-green-400 text-xs font-medium">+12.5% tendance</text>
                  </g>

                  {/* Enhanced floating particles */}
                  <circle cx="80" cy="70" r="3" fill="#8b5cf6" opacity="0.8" className="animate-bounce">
                    <animate attributeName="cy" values="70;65;70" dur="3s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="190" cy="90" r="2.5" fill="#ec4899" opacity="0.9" className="animate-pulse">
                    <animate attributeName="r" values="2.5;3.5;2.5" dur="2.5s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="290" cy="60" r="3" fill="#06b6d4" opacity="0.7" className="animate-pulse">
                    <animate attributeName="cy" values="60;55;60" dur="3.5s" repeatCount="indefinite"/>
                  </circle>

                  {/* Bottom axis line */}
                  <line x1="45" y1="205" x2="395" y2="205" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>
                </svg>

                {/* Enhanced overlay effects */}
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/3 via-transparent to-pink-500/3 group-hover:from-purple-500/6 group-hover:to-pink-500/6 transition-all duration-700"></div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/4 border border-white/6" style={{ boxShadow: neonGlow('blue') }}>
                <div className="text-sm text-white/50">Coût Mensuel</div>
                <div className="text-lg font-bold">{userPlan.cost.toFixed(2)}€</div>
              </div>
              <div className="p-4 rounded-lg bg-white/4 border border-white/6" style={{ boxShadow: neonGlow('violet') }}>
                <div className="text-sm text-white/50">Agents Utilisés</div>
                <div className="text-lg font-bold">{userPlan.agentsUsed}/{userPlan.agentsLimit}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/4 border border-white/6" style={{ boxShadow: neonGlow('green') }}>
                <div className="text-sm text-white/50">Conversations</div>
                <div className="text-lg font-bold">{userPlan.conversationsUsed.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-white/6 backdrop-blur" style={{ boxShadow: neonGlow('blue') }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Activité Récente</h3>
              <button className="text-sm text-white/50">Voir tout</button>
            </div>
            <ul className="space-y-3">
              <li className="p-3 rounded-lg bg-white/3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#8b5cf6] to-[#0ea5e9] text-black font-bold">N</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Nouveau lead qualifié</div>
                  <div className="text-xs text-white/50">Agent Support Client • 2 min</div>
                </div>
              </li>
              <li className="p-3 rounded-lg bg-white/3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] text-black font-bold">A</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Performance +15%</div>
                  <div className="text-xs text-white/50">Agent Commercial • 15 min</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Agents list */}
        <section className={generateSectionClass("agents-list")}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Mes Agents</h2>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-lg bg-white/5">Voir Tout</button>
              <button className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#ef4d95]">Créer</button>
            </div>
          </div>

          <div className="grid gap-6">
            {agents.map((a) => (<div key={a.id} className={`p-6 rounded-2xl bg-white/${dynamicStyles.backgroundOpacity} border border-white/${dynamicStyles.borderOpacity} flex items-start justify-between ${generateCardClass(a.id)}`} style={{
                boxShadow: `0 6px 30px rgba(139,92,246,${dynamicStyles.glowIntensity}), 0 0 30px rgba(219,39,119,0.08)`,
                '--primary-color': dynamicStyles.primaryColor,
                '--secondary-color': dynamicStyles.secondaryColor
            }}>
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${a.type === 'support' ? 'bg-[rgba(14,165,233,0.12)]' : a.type === 'sales' ? 'bg-[rgba(16,185,129,0.08)]' : 'bg-[rgba(139,92,246,0.08)]'}`}>
                      <lucide_react_1.Bot className="w-6 h-6 text-[#8b5cf6]"/>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{a.name}</div>
                      <div className="text-xs text-white/50">Dernière activité • {a.lastActivity}</div>
                    </div>
                    <div className="ml-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${a.status === 'active' ? 'bg-green-500/10 text-green-300' : a.status === 'paused' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-white/5 text-white/60'}`}>{a.status === 'active' ? 'Actif' : a.status === 'paused' ? 'Pause' : 'Archivé'}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-white/4 text-center data-pulse">
                      <div className="font-bold text-lg dynamic-primary-text">{a.conversations.toLocaleString()}</div>
                      <div className="text-xs text-white/50">Conversations</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/4 text-center data-pulse">
                      <div className="font-bold text-lg dynamic-secondary-text">{a.cost.toFixed(2)}€</div>
                      <div className="text-xs text-white/50">Coût</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/4 text-center data-pulse">
                      <div className={`font-bold text-lg ${a.satisfaction >= 4.5 ? 'satisfaction-excellent' : a.satisfaction >= 4 ? 'satisfaction-good' : 'satisfaction-poor'}`}>{a.satisfaction}/5</div>
                      <div className="text-xs text-white/50">Satisfaction</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/4 text-center data-pulse">
                      <div className="font-bold text-lg dynamic-primary-text">{a.lastActivity}</div>
                      <div className="text-xs text-white/50">Dernière activité</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-6">
                  <button className="p-2 rounded-md bg-white/5 hover:bg-white/8 transition"><lucide_react_1.BarChart3 className="w-4 h-4"/></button>
                  <button className="p-2 rounded-md bg-white/5 hover:bg-green-600 transition">{a.status === 'active' ? <lucide_react_1.Pause className="w-4 h-4"/> : <lucide_react_1.Play className="w-4 h-4"/>}</button>
                  <button className="p-2 rounded-md bg-white/5 hover:bg-white/8 transition"><lucide_react_1.Edit className="w-4 h-4"/></button>
                  <button className="p-2 rounded-md bg-white/5 hover:bg-red-600 transition"><lucide_react_1.Trash2 className="w-4 h-4"/></button>
                </div>
              </div>))}
          </div>
        </section>

        {/* Quick actions */}
        <section className={generateSectionClass("quick-actions")}>
          <h3 className="text-xl font-bold mb-4">Actions Rapides</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {quickActions.map((q, i) => {
            const Icon = q.icon;
            return (<div key={i} className="p-6 rounded-2xl border border-white/6 bg-[rgba(255,255,255,0.02)] hover:scale-[1.03] transition" style={{ boxShadow: neonGlow(i === 0 ? 'violet' : 'blue') }}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/6 border" style={{ boxShadow: neonGlow(i === 0 ? 'violet' : 'blue') }}>
                      <Icon className="w-6 h-6 text-[#8b5cf6]"/>
                    </div>
                    <div>
                      <div className="font-semibold">{q.title}</div>
                      <div className="text-sm text-white/50">{q.description}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end">
                    <lucide_react_1.ArrowUpRight className="w-5 h-5 text-[#8b5cf6]"/>
                  </div>
                </div>);
        })}
          </div>
        </section>

        <style jsx>{`
          /* Variables CSS dynamiques basées sur les données */
          .jsx-c756d3aa2cba7a04 {
            background: rgba(255, 255, 255, ${dynamicStyles.backgroundOpacity / 100});
            border-color: rgba(255, 255, 255, ${dynamicStyles.borderOpacity / 100});
            box-shadow: 0 6px 30px rgba(139, 92, 246, ${dynamicStyles.glowIntensity}), 0 0 30px rgba(219, 39, 119, 0.08);
          }

          .jsx-c756d3aa2cba7a04:hover {
            background: rgba(255, 255, 255, ${Math.min(dynamicStyles.backgroundOpacity / 100 + 0.02, 0.1)});
            box-shadow: 0 8px 40px rgba(139, 92, 246, ${dynamicStyles.glowIntensity + 0.1}), 0 0 40px rgba(219, 39, 119, 0.12);
          }

          /* Styles pour les métriques dynamiques */
          .dynamic-primary-text {
            color: ${dynamicStyles.primaryColor};
          }

          .dynamic-secondary-text {
            color: ${dynamicStyles.secondaryColor};
          }

          .satisfaction-excellent {
            color: #10b981;
          }

          .satisfaction-good {
            color: #f59e0b;
          }

          .satisfaction-poor {
            color: #ef4444;
          }

          /* Animation basée sur les données */
          @keyframes dataPulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }

          .data-pulse {
            animation: dataPulse 2s ease-in-out infinite;
          }

          /* Styles pour les éléments générés dynamiquement */
          [class*="jsx-card-"] {
            transition: all 0.3s ease;
          }

          [class*="jsx-card-"]:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 35px rgba(139, 92, 246, 0.4), 0 0 35px rgba(219, 39, 119, 0.15);
          }

          /* Neon pulse animation for interactive accents */
          @keyframes neonPulse {
            0% { box-shadow: 0 0 0px rgba(139,92,246,0.12);}
            50% { box-shadow: 0 0 20px rgba(139,92,246,0.18);}
            100% { box-shadow: 0 0 0px rgba(139,92,246,0.12);}
          }

          /* subtle floating */
          .float-y { animation: floatY 6s ease-in-out infinite; }
          @keyframes floatY { 0% { transform: translateY(0);} 50% { transform: translateY(-6px);} 100% { transform: translateY(0);} }

          /* add a glow when hovered on cards */
          .card-hover:hover { animation: neonPulse 2s infinite; }
        `}</style>
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map