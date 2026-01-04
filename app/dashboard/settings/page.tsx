"use client";

import React, { useState } from "react";
import { Settings, User, Shield, Bell, Palette, Save, Eye, EyeOff, Copy, Check, Mail, Building, FileText, Lock, Monitor, Globe, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const tabs = [
    { id: "profile", label: "Profil", icon: User },
    { id: "security", label: "Sécurité", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Apparence", icon: Palette }
  ];

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0f0520] text-white relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500 opacity-20 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 opacity-20 rounded-full filter blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500 opacity-10 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="relative z-10">
        <nav className="sticky top-0 z-50 border-b border-purple-500/20 bg-[#1a1b2e]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/30">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                    Paramètres
                  </span>
                  <p className="text-xs text-gray-400">Personnalisez votre expérience</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {saveSuccess && (
                  <span className="text-sm text-green-400 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Sauvegardé !
                  </span>
                )}
                <button 
                  onClick={handleSave}
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50"
                >
                  <Save className="w-4 h-4 mr-2 inline" />
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-4 backdrop-blur-xl">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                          isActive
                            ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30"
                            : "text-gray-400 hover:text-white hover:bg-purple-900/30"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-8 backdrop-blur-xl">
                {activeTab === "profile" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                        Informations du Profil
                      </h2>
                      <p className="text-gray-400">Gérez vos informations personnelles</p>
                    </div>

                    <div className="flex items-center gap-6 p-6 bg-[#0f1020] rounded-xl border border-purple-500/20">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-3xl font-bold shadow-lg shadow-pink-500/30">
                        JD
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Photo de profil</h3>
                        <div className="flex gap-3">
                          <button className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-sm rounded-lg transition">
                            Changer
                          </button>
                          <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition border border-red-500/30">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <User className="w-4 h-4" />
                            Nom complet
                          </label>
                          <input
                            type="text"
                            defaultValue="John Doe"
                            className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <Mail className="w-4 h-4" />
                            Email
                          </label>
                          <input
                            type="email"
                            defaultValue="john@twinmcp.com"
                            className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                          <Building className="w-4 h-4" />
                          Entreprise
                        </label>
                        <input
                          type="text"
                          defaultValue="TwinMCP"
                          className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                          <FileText className="w-4 h-4" />
                          Bio
                        </label>
                        <textarea
                          rows={4}
                          defaultValue="Développeur passionné par l'IA et les nouvelles technologies."
                          className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                        Sécurité & Confidentialité
                      </h2>
                      <p className="text-gray-400">Protégez votre compte et vos données</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-5 bg-[#0f1020] rounded-xl border border-green-500/30 hover:border-green-500/50 transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-green-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Authentification à deux facteurs</h3>
                            <p className="text-sm text-gray-400 mt-1">Renforcez la sécurité de votre compte avec 2FA</p>
                          </div>
                        </div>
                        <button className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition">
                          Activer
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-5 bg-[#0f1020] rounded-xl border border-purple-500/30 hover:border-purple-500/50 transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Monitor className="w-6 h-6 text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Sessions actives</h3>
                            <p className="text-sm text-gray-400 mt-1">3 appareils connectés actuellement</p>
                          </div>
                        </div>
                        <button className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg transition">
                          Gérer
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-5 bg-[#0f1020] rounded-xl border border-purple-500/30 hover:border-purple-500/50 transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Lock className="w-6 h-6 text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Changer le mot de passe</h3>
                            <p className="text-sm text-gray-400 mt-1">Dernière modification il y a 3 mois</p>
                          </div>
                        </div>
                        <button className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg transition">
                          Modifier
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                        <h3 className="font-semibold text-xl text-red-400">Zone de danger</h3>
                      </div>
                      <p className="text-sm text-gray-300 mb-4">
                        La suppression de votre compte est irréversible. Toutes vos données seront définitivement perdues.
                      </p>
                      <button className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition">
                        Supprimer le compte
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "notifications" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                        Notifications
                      </h2>
                      <p className="text-gray-400">Personnalisez vos préférences de notification</p>
                    </div>

                    <div className="space-y-3">
                      {[
                        { title: "Nouveaux messages", description: "Recevoir des notifications pour les nouveaux messages", icon: Mail, checked: true },
                        { title: "Rapports hebdomadaires", description: "Résumé de l'activité de vos serveurs MCP", icon: FileText, checked: true },
                        { title: "Alertes de sécurité", description: "Notifications importantes pour la sécurité", icon: Shield, checked: true },
                        { title: "Mises à jour produit", description: "Informations sur les nouvelles fonctionnalités", icon: Settings, checked: false }
                      ].map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <div key={index} className="flex items-center justify-between p-5 bg-[#0f1020] rounded-xl border border-purple-500/30 hover:border-purple-500/50 transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Icon className="w-6 h-6 text-purple-400" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{item.title}</h3>
                                <p className="text-sm text-gray-400 mt-0.5">{item.description}</p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" defaultChecked={item.checked} />
                              <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-purple-600 shadow-lg"></div>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === "appearance" && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                        Apparence & Interface
                      </h2>
                      <p className="text-gray-400">Personnalisez l'apparence de votre interface</p>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-4">
                          <Palette className="w-4 h-4" />
                          Thème
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { name: "Clair", gradient: "from-gray-100 to-gray-200" },
                            { name: "Sombre", gradient: "from-gray-800 to-gray-900" },
                            { name: "TwinMCP", gradient: "from-pink-500 to-purple-600", active: true }
                          ].map((theme) => (
                            <button
                              key={theme.name}
                              className={`relative p-6 rounded-xl border-2 transition-all ${
                                theme.active
                                  ? "border-pink-500 shadow-lg shadow-pink-500/30"
                                  : "border-purple-500/30 hover:border-purple-500/50"
                              }`}
                            >
                              <div className={`w-full h-20 rounded-lg bg-gradient-to-br ${theme.gradient} mb-3`}></div>
                              <p className="font-semibold text-center">{theme.name}</p>
                              {theme.active && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                          <Globe className="w-4 h-4" />
                          Langue
                        </label>
                        <select className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition cursor-pointer">
                          <option>Français</option>
                          <option>English</option>
                          <option>Español</option>
                          <option>Deutsch</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-5 bg-[#0f1020] rounded-xl border border-purple-500/30 hover:border-purple-500/50 transition-all">
                        <div>
                          <h3 className="font-semibold">Animations réduites</h3>
                          <p className="text-sm text-gray-400 mt-1">Désactiver les animations pour de meilleures performances</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-purple-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}