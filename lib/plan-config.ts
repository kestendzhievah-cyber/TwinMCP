interface PlanConfig {
  [key: string]: {
    mcpServers: number;
    requestsPerDay: number;
    privateServers: boolean;
    features: string[];
    support: string;
    price: number;
    priceAnnual: number;
  };
}

export const PLAN_CONFIG: PlanConfig = {
  free: {
    mcpServers: 3,
    requestsPerDay: 200,
    privateServers: false,
    features: [
      '3 serveurs MCP',
      '200 requêtes/jour',
      'Accès bibliothèque publique',
      'Support communauté',
      'Documentation complète'
    ],
    support: 'Communauté',
    price: 0,
    priceAnnual: 0
  },
  pro: {
    mcpServers: -1, // Illimité
    requestsPerDay: 10000,
    privateServers: true,
    features: [
      'Serveurs MCP illimités',
      '10 000 requêtes/jour',
      'Serveurs privés',
      'Support prioritaire 24/7',
      'Analytics avancés',
      'API complète',
      'Webhooks & intégrations'
    ],
    support: 'Prioritaire 24/7',
    price: 14.99,
    priceAnnual: 11.24
  },
  // Backward compatibility alias
  professional: {
    mcpServers: -1,
    requestsPerDay: 10000,
    privateServers: true,
    features: [
      'Serveurs MCP illimités',
      '10 000 requêtes/jour',
      'Serveurs privés',
      'Support prioritaire 24/7',
      'Analytics avancés',
      'API complète',
      'Webhooks & intégrations'
    ],
    support: 'Prioritaire 24/7',
    price: 14.99,
    priceAnnual: 11.24
  },
  enterprise: {
    mcpServers: -1, // Illimité
    requestsPerDay: -1, // Illimité
    privateServers: true,
    features: [
      'Tout du plan Pro',
      'Requêtes illimitées',
      'Serveurs MCP personnalisés',
      'Account manager dédié',
      'SLA 99.9%',
      'Déploiement on-premise',
      'Formation & onboarding',
      'White-label disponible'
    ],
    support: 'Account manager dédié',
    price: -1, // Sur devis
    priceAnnual: -1
  }
};

// Fonction utilitaire pour obtenir la configuration d'un plan
export function getPlanConfig(plan: keyof PlanConfig) {
  return PLAN_CONFIG[plan];
}

// Fonction pour déterminer le plan suggéré lors d'un upgrade
export function getSuggestedUpgrade(currentPlan: keyof PlanConfig): keyof PlanConfig | null {
  switch (currentPlan) {
    case 'free':
      return 'pro';
    case 'pro':
    case 'professional':
      return 'enterprise';
    case 'enterprise':
      return null;
    default:
      return 'pro';
  }
}

// Fonction pour vérifier si un plan a une limite illimitée
export function isUnlimited(value: number): boolean {
  return value === -1;
}

// Fonction pour formater l'affichage des limites
export function formatLimit(value: number, unit: string = ''): string {
  if (isUnlimited(value)) {
    return '∞';
  }
  return `${value.toLocaleString()}${unit}`;
}
