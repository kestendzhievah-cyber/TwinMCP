"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdChatbot, setCreatedChatbot] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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
    setApiError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) {
        try {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        } catch { /* continue without token */ }
      }

      const response = await fetch('/api/chatbot/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setCreatedChatbot(result);
        setShowSuccessModal(true);
      } else if (result.error === 'LIMIT_REACHED') {
        setApiError(result.message || 'Limite de chatbots atteinte. Passez au plan supérieur.');
      } else {
        setApiError(result.error || 'Erreur lors de la création du chatbot');
      }
    } catch (error) {
      console.error('Error creating chatbot:', error);
      setApiError('Erreur de connexion. Veuillez réessayer.');
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
    <div className="space-y-6">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
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
                <span className="text-sm font-medium text-purple-400">Configuration</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-700"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-700 text-gray-400 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-sm font-medium text-gray-500">Test</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-700"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-700 text-gray-400 rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <span className="text-sm font-medium text-gray-500">Publication</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* API Error */}
          {apiError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{apiError}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="bg-[#1a1b2e] rounded-2xl border border-purple-500/20 p-6 lg:p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Informations de base
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du chatbot *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 bg-[#0f1020] border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                    errors.name ? 'border-red-500/50' : 'border-purple-500/30'
                  }`}
                  placeholder="Mon Assistant Support"
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Modèle IA *
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f1020] border border-purple-500/30 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>
                {selectedModel && (
                  <div className="mt-2 p-3 bg-[#0f1020] rounded-lg border border-purple-500/10">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{selectedModel.description}</span>
                      <span className="font-medium text-purple-400">{selectedModel.cost}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>Performance: {'★'.repeat(selectedModel.quality)}</span>
                      <span>Vitesse: {selectedModel.speed}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description courte *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 bg-[#0f1020] border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                  errors.description ? 'border-red-500/50' : 'border-purple-500/30'
                }`}
                placeholder="Décrivez brièvement ce que fait votre chatbot..."
              />
              {errors.description && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* AI Configuration */}
          <div className="bg-[#1a1b2e] rounded-2xl border border-purple-500/20 p-6 lg:p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              Configuration IA
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Instructions du système *
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                  rows={6}
                  className={`w-full px-4 py-3 bg-[#0f1020] border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors font-mono text-sm ${
                    errors.systemPrompt ? 'border-red-500/50' : 'border-purple-500/30'
                  }`}
                  placeholder="Décrivez le comportement et les connaissances de votre chatbot..."
                />
                {errors.systemPrompt && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.systemPrompt}
                  </p>
                )}
                <p className="text-gray-500 text-sm mt-1">
                  Ces instructions définissent comment votre chatbot doit se comporter et répondre.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Température: {formData.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Conservateur (0)</span>
                    <span>Créatif (2)</span>
                  </div>
                  {errors.temperature && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.temperature}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tokens maximum: {formData.maxTokens}
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="100"
                    value={formData.maxTokens}
                    onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Court (100)</span>
                    <span>Long (4000)</span>
                  </div>
                  {errors.maxTokens && (
                    <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
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
              className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/30"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b2e] rounded-2xl max-w-md w-full p-8 border border-purple-500/20">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">
                Chatbot créé avec succès !
              </h3>

              <p className="text-gray-400 mb-6">
                Votre chatbot est maintenant disponible et prêt à être partagé.
              </p>

              <div className="space-y-4">
                <div className="bg-[#0f1020] rounded-lg p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-400">Lien de partage</span>
                    <button
                      onClick={() => copyToClipboard(createdChatbot.publicUrl)}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-purple-400 font-mono break-all">
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
                    className="flex-1 px-4 py-2 bg-[#0f1020] border border-purple-500/20 text-gray-300 rounded-lg hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    onClick={() => router.push(`/chat/${createdChatbot.chatbotId}`)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
                  >
                    Tester
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push('/dashboard');
                  }}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
