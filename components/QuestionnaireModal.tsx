'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface QuestionnaireModalProps {
  onClose: () => void;
}

type FormData = {
  discovery: string;
  whyUse: string;
  activitySector: string;
  suggestions: string;
};

export default function QuestionnaireModal({ onClose }: QuestionnaireModalProps) {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    discovery: '',
    whyUse: '',
    activitySector: '',
    suggestions: ''
  });

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà répondu au questionnaire
    if (typeof window !== 'undefined') {
      try {
        const hasAnswered = localStorage.getItem('hasAnsweredQuestionnaire');
        if (hasAnswered) {
          onClose();
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [onClose]);

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const [otherSector, setOtherSector] = useState('');

  const handleClose = () => {
  // Ne marque plus comme répondu ici
  onClose();
};
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validation des champs...
  
  if (currentStep < 3) {
    handleNext();
  } else {
    // Marquer comme complété uniquement à la soumission
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hasAnsweredQuestionnaire', 'completed');
      } catch {
        // Ignore
      }
    }
    setHasSubmitted(true);
    onClose();
  }
};

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Question 1/3 - Découverte</h3>
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Comment avez-vous découvert nos services ?
              </label>
              <div className="space-y-2">
                {[
                  { id: 'freq-1', value: 'web', label: 'Navigateur Web' },
                  { id: 'freq-2', value: 'tiktok', label: 'TikTok' },
                  { id: 'freq-3', value: 'instagram', label: 'Instagram' },
                  { id: 'freq-4', value: 'facebook', label: 'Facebook' },
                  { id: 'freq-5', value: 'spotify', label: 'Spotify' }
                ].map((option) => (
                  <div key={option.id} className="flex items-center">
                    <input
                      id={option.id}
                      name="discovery"
                      type="radio"
                      checked={formData.discovery === option.value}
                      onChange={handleInputChange}
                      value={option.value}
                      className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-gray-600"
                      required
                    />
                    <label htmlFor={option.id} className="ml-3 block text-sm text-white">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white mb-4">Question 2/3 - Pourquoi notre plateforme</h3>
            <div>
              <label htmlFor="suggestions" className="block text-sm font-medium text-white mb-2">
                Pourquoi utilisez-vous notre plateforme ?
              </label>
              <div className="space-y-2">
                {[
                  { id: 'freq-1', value: 'time', label: 'Gain de temps en productivité' },
                  { id: 'freq-2', value: 'organisation', label: 'Meilleure organisation' },
                  { id: 'freq-3', value: 'LLMupgrade', label: 'Amélioration de vos LLM' }
                ].map((option) => (
                  <div key={option.id} className="flex items-center">
                    <input
                      id={option.id}
                      name="whyUse"
                      type="radio"
                      checked={formData.whyUse === option.value}
                      onChange={handleInputChange}
                      value={option.value}
                      className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-gray-600"
                      required
                    />
                    <label htmlFor={option.id} className="ml-3 block text-sm text-white">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        case 3:
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-white mb-4">Question 3/3 - Secteur d'activité</h3>
      <div>
        <label className="block text-sm font-medium text-white mb-3">
          Dans quel secteur d'activité travaillez-vous ?
        </label>
        <div className="space-y-2">
          {[
            { id: 'sect-1', value: 'technologie', label: 'Technologie' },
            { id: 'sect-2', value: 'finance', label: 'Finance' },
            { id: 'sect-3', value: 'sante', label: 'Santé' },
            { id: 'sect-4', value: 'education', label: 'Éducation' },
            { id: 'sect-5', value: 'autre', label: 'Autre' }
          ].map((option) => (
            <div key={option.id} className="flex flex-col">
              <div className="flex items-center">
                <input
                  id={option.id}
                  name="activitySector"
                  type="radio"
                  checked={formData.activitySector === option.value}
                  onChange={(e) => {
                    handleInputChange(e);
                    // Réinitialiser le champ autre si on change d'option
                    if (option.value !== 'autre') {
                      setOtherSector('');
                    }
                  }}
                  value={option.value}
                  className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-gray-600"
                  required
                />
                <label htmlFor={option.id} className="ml-3 block text-sm text-white">
                  {option.label}
                </label>
              </div>
              {option.value === 'autre' && formData.activitySector === 'autre' && (
                <div className="mt-2 ml-7">
                  <input
                    type="text"
                    value={otherSector}
                    onChange={(e) => setOtherSector(e.target.value)}
                    placeholder="Précisez votre secteur d'activité"
                    className="w-full px-3 py-2 bg-[#0f081d] border border-purple-900/50 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    required
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
      default:
        return null;
    }
  };

  if (hasSubmitted) return null;

  // Fonction pour réinitialiser le questionnaire
  const resetQuestionnaire = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('hasAnsweredQuestionnaire');
      } catch {
        // Ignore
      }
    }
    setCurrentStep(1);
    setHasSubmitted(false);
    setFormData({
      discovery: '',
      whyUse: '',
      activitySector: '',
      suggestions: ''
    });
  };

  // En mode développement, afficher un bouton de réinitialisation
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {isDev && (
        <button
          onClick={resetQuestionnaire}
          className="fixed top-4 right-4 bg-red-500 text-white px-3 py-1 rounded text-sm z-50"
          title="Réinitialiser le questionnaire (visible uniquement en mode développement)"
        >
          Réinitialiser
        </button>
      )}
      <div className="bg-black border border-purple-700/30 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold bg-clip-text text-white bg-gradient-to-r from-fuchsia-400 to-purple-400">
              Questionnaire
            </h2>
            <button
              onClick={onClose}
              className="text-purple-300 hover:text-white transition-colors"
              aria-label="Fermer le questionnaire"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Barre de progression */}
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(currentStep / 3) * 100}%` }}
              ></div>
            </div>
            
            {/* Étape actuelle */}
            {renderStep()}

            <div className="flex justify-between pt-4">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="px-5 py-2 text-white font-medium bg-purple-900/30 hover:bg-purple-800/50 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  Précédent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 text-white font-medium bg-purple-900/30 hover:bg-purple-800/50 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  Plus tard
                </button>
              )}
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className={`px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:from-purple-600 hover:to-pink-600 ${
                    (currentStep === 1 && !formData.discovery) ||
                    (currentStep === 2 && !formData.whyUse) ||
                    (currentStep === 3 && !formData.activitySector)
                      ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={
                    (currentStep === 1 && !formData.discovery) ||
                    (currentStep === 2 && !formData.whyUse) ||
                    (currentStep === 3 && !formData.activitySector)
                  }
                >
                  {currentStep === 3 ? 'Envoyer' : 'Suivant'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
