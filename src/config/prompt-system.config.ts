export const PROMPT_SYSTEM_CONFIG = {
  templates: {
    maxVersions: 10,
    autoSaveInterval: 300000, // 5 minutes
    cacheTTL: 3600, // 1 hour
    validationRules: {
      maxTemplateLength: 10000,
      maxVariables: 50,
      requiredVariablePrefix: 'req_',
      forbiddenPatterns: [
        /password/i,
        /secret/i,
        /token/i,
        /api[_-]?key/i
      ]
    }
  },
  optimization: {
    enabled: true,
    interval: 86400000, // 24 hours
    minExecutions: 100,
    targetImprovement: 0.05, // 5%
    algorithms: ['genetic', 'hill_climbing', 'simulated_annealing']
  },
  testing: {
    abTest: {
      minSampleSize: 1000,
      confidence: 0.95,
      maxDuration: 7 * 86400000, // 7 days
      autoStop: true
    },
    quality: {
      minRating: 3.0,
      feedbackRequired: 0.1, // 10% of executions
      automatedTests: true
    }
  },
  analytics: {
    retention: 90, // days
    aggregation: {
      realTime: true,
      intervals: ['hour', 'day', 'week', 'month']
    }
  }
};

export const DEFAULT_PROMPT_CATEGORIES = [
  {
    id: 'chat',
    name: 'Chat & Conversation',
    description: 'Templates for conversational AI',
    icon: '💬',
    color: '#3B82F6',
    order: 1
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Templates for documentation generation and analysis',
    icon: '📚',
    color: '#10B981',
    order: 2
  },
  {
    id: 'code',
    name: 'Code Generation',
    description: 'Templates for code generation and analysis',
    icon: '💻',
    color: '#8B5CF6',
    order: 3
  },
  {
    id: 'analysis',
    name: 'Analysis & Research',
    description: 'Templates for data analysis and research',
    icon: '🔍',
    color: '#F59E0B',
    order: 4
  },
  {
    id: 'system',
    name: 'System & Utility',
    description: 'System-level and utility templates',
    icon: '⚙️',
    color: '#6B7280',
    order: 5
  }
];
