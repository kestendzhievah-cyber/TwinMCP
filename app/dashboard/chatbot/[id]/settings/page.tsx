"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Bot,
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Settings,
  MessageSquare,
  Clock,
  Users,
  TrendingUp,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface Chatbot {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  conversationsCount: number;
}

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

// Types pour les états de chargement et d'erreur
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Type pour les erreurs du formulaire
type FormErrors = Partial<Record<keyof Omit<Chatbot, 'id' | 'conversationsCount'>, string>>;

export default function EditChatbotPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params.id as string;

  // États de chargement
  const [loadState, setLoadState] = useState<LoadingState>('idle');
  const [saveState, setSaveState] = useState<LoadingState>('idle');
  
  // États pour le chatbot et les données du formulaire
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [formData, setFormData] = useState<Omit<Chatbot, 'id' | 'conversationsCount'>>({
    name: '',
    description: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 1000,
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Charger les données du chatbot
  useEffect(() => {
    const loadChatbot = async () => {
      if (!chatbotId) return;
      
      setLoadState('loading');
      
      try {
        const response = await fetch(`/api/chatbot/${chatbotId}`);
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        setChatbot(data);
        setFormData({
          name: data.name,
          description: data.description,
          model: data.model,
          systemPrompt: data.systemPrompt,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          isActive: data.isActive,
        });
        
        setLoadState('success');
        toast.success('Chatbot chargé avec succès');
        
      } catch (error) {
        console.error('Erreur lors du chargement du chatbot:', error);
        setLoadState('error');
        toast.error('Échec du chargement du chatbot');
      }
    };

    loadChatbot();
  }, [chatbotId]);

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

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaveState('loading');
    
    try {
      const response = await fetch(`/api/chatbot/${chatbotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const updatedChatbot = await response.json();
      
      setChatbot(updatedChatbot);
      setSaveState('success');
      toast.success('Chatbot mis à jour avec succès');
      
      // Rediriger vers le tableau de bord après un court délai
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour du chatbot:', error);
      setSaveState('error');
      toast.error('Échec de la mise à jour du chatbot');
    }
  };

  const selectedModel = availableModels.find(m => m.id === formData.model);

  // État de chargement
  if (loadState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-600">Chargement du chatbot...</p>
      </div>
    );
  }
  
  // État d'erreur
  if (loadState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Erreur de chargement</h2>
        <p className="text-gray-600">
          Impossible de charger les données du chatbot. Veuillez réessayer plus tard.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-slate-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Chatbot introuvable</h2>
          <p className="text-slate-600 mb-4">Le chatbot que vous recherchez n'existe pas.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }

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

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Modifier {chatbot.name}</h1>
                <p className="text-slate-600">Modifiez les paramètres et instructions de votre chatbot</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600 mb-1">
                  <MessageSquare className="w-4 h-4" />
                  Conversations
                </div>
                <div className="text-2xl font-bold text-slate-900">{chatbot.conversationsCount.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600 mb-1">
                  <Users className="w-4 h-4" />
                  Visiteurs
                </div>
                <div className="text-2xl font-bold text-slate-900">847</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600 mb-1">
                  <Clock className="w-4 h-4" />
                  Temps réponse
                </div>
                <div className="text-2xl font-bold text-slate-900">2.3s</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Satisfaction
                </div>
                <div className="text-2xl font-bold text-slate-900">4.8/5</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="space-y-8">
          {/* Basic Information */}
          <div className="bg-black rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5" />
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
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
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

            {/* Status Toggle */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Statut du chatbot
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('isActive', true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.isActive
                      ? 'bg-green-100 text-green-800 border-2 border-green-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Actif
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('isActive', false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    !formData.isActive
                      ? 'bg-red-100 text-red-800 border-2 border-red-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Inactif
                </button>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                {formData.isActive
                  ? 'Le chatbot peut recevoir des messages et répondre aux utilisateurs.'
                  : 'Le chatbot est en pause et ne répondra pas aux nouveaux messages.'
                }
              </p>
            </div>
          </div>

          {/* AI Configuration */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <Bot className="w-5 h-5" />
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
                  rows={8}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm ${
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
                  Ces instructions définissent comment votre chatbot doit se comporter et répondre. Plus elles sont détaillées, meilleures seront les réponses.
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
                    <span>Conservateur (0)</span>
                    <span>Créatif (2)</span>
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
                    <span>Court (100)</span>
                    <span>Long (4000)</span>
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

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saveState === 'loading' || saveState === 'success'}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-white ${
                saveState === 'loading' || saveState === 'success'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } transition-colors`}
            >
              {saveState === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : saveState === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Enregistré !
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
