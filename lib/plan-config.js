"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_CONFIG = void 0;
exports.getPlanConfig = getPlanConfig;
exports.getSuggestedUpgrade = getSuggestedUpgrade;
exports.isUnlimited = isUnlimited;
exports.formatLimit = formatLimit;
exports.PLAN_CONFIG = {
    starter: {
        agents: 1,
        conversations: 1000,
        models: ['gpt-3.5-turbo'],
        features: [
            '1 agent IA',
            '1 000 conversations/mois',
            'Modèles basiques (GPT-3.5)',
            'Support email',
            'Analytics basiques'
        ],
        support: 'Email',
        price: 29
    },
    professional: {
        agents: 5,
        conversations: 10000,
        models: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku', 'claude-3-sonnet', 'gemini-pro'],
        features: [
            '5 agents IA',
            '10 000 conversations/mois',
            'Tous les modèles (GPT-4, Claude, Gemini)',
            'Support prioritaire 24/7',
            'Analytics avancés',
            'Intégrations CRM',
            'API complète'
        ],
        support: 'Prioritaire 24/7',
        price: 99
    },
    enterprise: {
        agents: -1, // Illimité
        conversations: -1, // Illimité
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus', 'gemini-pro', 'gemini-pro-vision', 'custom-ai'],
        features: [
            'Agents illimités',
            'Conversations illimitées',
            'Tous les modèles + Custom AI',
            'Account manager dédié',
            'SLA 99.9%',
            'Intégrations sur-mesure',
            'Formation & onboarding',
            'White-label disponible'
        ],
        support: 'Account manager dédié',
        price: 499
    }
};
// Fonction utilitaire pour obtenir la configuration d'un plan
function getPlanConfig(plan) {
    return exports.PLAN_CONFIG[plan];
}
// Fonction pour déterminer le plan suggéré lors d'un upgrade
function getSuggestedUpgrade(currentPlan) {
    switch (currentPlan) {
        case 'starter':
            return 'professional';
        case 'professional':
            return 'enterprise';
        case 'enterprise':
            return null;
        default:
            return 'professional';
    }
}
// Fonction pour vérifier si un plan a une limite illimitée
function isUnlimited(value) {
    return value === -1;
}
// Fonction pour formater l'affichage des limites
function formatLimit(value, unit = '') {
    if (isUnlimited(value)) {
        return '∞';
    }
    return `${value.toLocaleString()}${unit}`;
}
//# sourceMappingURL=plan-config.js.map