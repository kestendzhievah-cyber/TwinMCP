"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Send,
  Settings,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  QrCode
} from 'lucide-react';

interface Model {
  id: string;
  name: string;
  provider: string;
  cost: string;
  speed: string;
  quality: number;
  description: string;
}

const availableModels: Model[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    cost: '0.01€/1K tokens',
    speed: 'Rapide',
    quality: 5,
    description: 'Le plus puissant, raisonnement avancé'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    cost: '0.002€/1K tokens',
    speed: 'Très rapide',
    quality: 4,
    description: 'Rapide et économique pour tâches simples'
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    cost: '0.015€/1K tokens',
    speed: 'Rapide',
    quality: 5,
    description: 'Excellence en analyse et créativité'
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    cost: '0.003€/1K tokens',
    speed: 'Très rapide',
    quality: 4,
    description: 'Équilibre parfait entre coût et performance'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    cost: '0.0005€/1K tokens',
    speed: 'Ultra rapide',
    quality: 4,
    description: 'Excellent rapport qualité-prix'
  }
];

export default function CreateChatbotPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdChatbot, setCreatedChatbot] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 1000,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La description est requise';
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'Les instructions sont requises';
    }

    if (formData.temperature < 0 || formData.temperature > 2) {
      newErrors.temperature = 'La température doit être entre 0 et 2';
    }

    if (formData.maxTokens < 100 || formData.maxTokens > 4000) {
      newErrors.maxTokens = 'Les tokens doivent être entre 100 et 4000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Get auth token and call API
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful response
      const mockResponse = {
        success: true,
        chatbotId: 'abc123xyz',
        publicUrl: 'https://your-domain.com/chat/abc123xyz',
        qrCode: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMTAwIiByPSI1MCIgZmlsbD0iIzAwMCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTA1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiNmZmYiPkFiQzEyM1hZejwvdGV4dD48L3N2Zz4=',
      };

      setCreatedChatbot(mockResponse);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating chatbot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadQRCode = () => {
    if (!createdChatbot) return;

    const link = document.createElement('a');
    link.href = createdChatbot.qrCode;
    link.download = `${formData.name}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedModel = availableModels.find(m => m.id === formData.model);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au dashboard
          </button>

          <div className="bg-[#1a1b2e] rounded-2xl shadow-sm border border-purple-500/20 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Créer mon Chatbot</h1>
                <p className="text-gray-400">Configurez votre assistant IA personnel</p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <span className="text-sm font-medium text-blue-600">Configuration</span>
              </div>
              <div className="w-16 h-0.5 bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-sm font-medium text-slate-400">Test</span>
              </div>
              <div className="w-16 h-0.5 bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <span className="text-sm font-medium text-slate-400">Publication</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-[#1a1b2e] rounded-2xl shadow-sm border border-purple-500/20 p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Informations de base
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom du chatbot *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-black ${
                    errors.name ? 'border-red-300' : 'border-slate-300'
                  }`}
                  placeholder="Mon Assistant Support"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Modèle IA *
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-black"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>
                {selectedModel && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{selectedModel.description}</span>
                      <span className="font-medium text-slate-900">{selectedModel.cost}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>Performance: {'★'.repeat(selectedModel.quality)}</span>
                      <span>Vitesse: {selectedModel.speed}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description courte *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-black ${
                  errors.description ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="Décrivez brièvement ce que fait votre chatbot..."
              />
              {errors.description && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* AI Configuration */}
          <div className="bg-[#1a1b2e] rounded-2xl shadow-sm border border-purple-500/20 p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              Configuration IA
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Instructions du système *
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-black ${
                    errors.systemPrompt ? 'border-red-300' : 'border-slate-300'
                  }`}
                  placeholder="Décrivez le comportement et les connaissances de votre chatbot..."
                />
                {errors.systemPrompt && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.systemPrompt}
                  </p>
                )}
                <p className="text-slate-500 text-sm mt-1">
                  Ces instructions définissent comment votre chatbot doit se comporter et répondre.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Température: {formData.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Conservateur</span>
                    <span>Créatif</span>
                  </div>
                  {errors.temperature && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.temperature}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tokens maximum: {formData.maxTokens}
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="100"
                    value={formData.maxTokens}
                    onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Court</span>
                    <span>Long</span>
                  </div>
                  {errors.maxTokens && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.maxTokens}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Création en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Créer mon Chatbot
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      {showSuccessModal && createdChatbot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] rounded-2xl max-w-md w-full p-8 border border-purple-500/20">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">
                Chatbot créé avec succès !
              </h3>

              <p className="text-gray-400 mb-6">
                Votre chatbot est maintenant disponible et prêt à être partagé.
              </p>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Lien de partage</span>
                    <button
                      onClick={() => copyToClipboard(createdChatbot.publicUrl)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-900 font-mono break-all">
                    {createdChatbot.publicUrl}
                  </p>
                </div>

                <div className="flex justify-center">
                  {createdChatbot.qrCode.startsWith('data:image/svg') ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: atob(createdChatbot.qrCode.split(',')[1])
                      }}
                      className="w-32 h-32 border rounded-lg p-2 bg-white"
                    />
                  ) : (
                    <img
                      src={createdChatbot.qrCode}
                      alt="QR Code"
                      className="w-32 h-32 border rounded-lg"
                    />
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={downloadQRCode}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    onClick={() => router.push(`/chat/${createdChatbot.chatbotId}`)}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Tester
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push('/dashboard');
                  }}
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Aller au dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
