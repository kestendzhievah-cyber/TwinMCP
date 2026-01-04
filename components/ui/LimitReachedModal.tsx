import React from 'react';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    current: number;
    max: number;
    plan: string;
    suggestedPlan: string | null;
    message: string;
  };
  onManageAgents: () => void;
  onUpgrade: () => void;
}

export function LimitReachedModal({ isOpen, onClose, data, onManageAgents, onUpgrade }: LimitReachedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Limite atteinte</h3>
          <p className="text-gray-600 mb-4">{data.message}</p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">
              Plan actuel: {data.plan} | Utilisation: {data.current}/{data.max}
              {data.suggestedPlan && (
                <span className="block mt-2">Plan suggéré: {data.suggestedPlan}</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={onManageAgents}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Gérer les agents
            </button>
            <button
              onClick={onUpgrade}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Mettre à niveau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
