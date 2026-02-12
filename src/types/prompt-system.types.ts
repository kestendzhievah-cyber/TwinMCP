// Types et interfaces pour le système de prompts

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  template: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  metadata: {
    author: string;
    tags: string[];
    optimizedFor: string[];
    language: string;
    complexity: 'basic' | 'intermediate' | 'advanced';
    estimatedTokens: number;
    lastUpdated: Date;
    usageCount: number;
    successRate: number;
    averageRating: number;
  };
  constraints: {
    maxTokens?: number;
    minTokens?: number;
    requiredVariables: string[];
    forbiddenPatterns: string[];
    allowedModels: string[];
  };
  optimization: {
    autoOptimize: boolean;
    targetMetrics: PromptMetric[];
    optimizationHistory: OptimizationRecord[];
  };
  testing: {
    abTests: ABTest[];
    lastTestDate?: Date;
    testResults: TestResult[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptCategory {
  id: string;
  name: string;
  description: string;
  parentCategory?: string;
  icon: string;
  color: string;
  order: number;
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'context';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: VariableValidation;
  formatting?: VariableFormatting;
  examples: string[];
  dependencies: string[]; // Variables dépendantes
}

export interface VariableValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  customFunction?: string;
}

export interface VariableFormatting {
  uppercase?: boolean;
  lowercase?: boolean;
  trim?: boolean;
  sanitize?: boolean;
  maxLength?: number;
  prefix?: string;
  suffix?: string;
}

export interface PromptExample {
  id: string;
  name: string;
  description: string;
  variables: Record<string, any>;
  expectedOutput?: string;
  actualOutput?: string;
  rating?: number;
  feedback?: string;
  createdAt: Date;
}

export interface PromptMetric {
  name: string;
  type: 'latency' | 'quality' | 'cost' | 'tokens' | 'satisfaction';
  target: number;
  weight: number;
  direction: 'minimize' | 'maximize';
}

export interface OptimizationRecord {
  id: string;
  timestamp: Date;
  type: 'auto' | 'manual';
  reason: string;
  changes: PromptChange[];
  metricsBefore: Record<string, number>;
  metricsAfter: Record<string, number>;
  improvement: number;
}

export interface PromptChange {
  type: 'template' | 'variable' | 'constraint' | 'metadata';
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  variants: ABTestVariant[];
  trafficSplit: Record<string, number>;
  startDate?: Date;
  endDate?: Date;
  sampleSize: number;
  confidence: number;
  results?: ABTestResult;
  createdAt: Date;
}

export interface ABTestVariant {
  id: string;
  name: string;
  templateId: string;
  weight: number;
  metrics: Record<string, number>;
  conversions: number;
  impressions: number;
}

export interface ABTestResult {
  winner: string;
  significance: number;
  confidence: number;
  improvement: number;
  recommendation: string;
  detailedMetrics: Record<string, ABTestMetric>;
}

export interface ABTestMetric {
  variant: string;
  value: number;
  change: number;
  significance: boolean;
  confidence: number;
}

export interface TestResult {
  id: string;
  testType: 'unit' | 'integration' | 'performance' | 'quality';
  status: 'passed' | 'failed' | 'warning';
  score: number;
  details: string;
  timestamp: Date;
}

export interface PromptExecution {
  id: string;
  templateId: string;
  templateVersion: string;
  variables: Record<string, any>;
  renderedPrompt: string;
  context?: any;
  model: string;
  provider: string;
  response: string;
  metrics: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    latency: number;
    cost: number;
  };
  quality: {
    relevance: number;
    coherence: number;
    completeness: number;
    userRating?: number;
  };
  feedback?: {
    rating: number;
    comment: string;
    timestamp: Date;
  };
  abTestVariant?: string;
  createdAt: Date;
}

export interface PromptAnalytics {
  templateId: string;
  period: {
    start: Date;
    end: Date;
  };
  usage: {
    totalExecutions: number;
    uniqueUsers: number;
    averageLatency: number;
    successRate: number;
    errorRate: number;
  };
  performance: {
    averageTokens: number;
    averageCost: number;
    qualityScore: number;
    userSatisfaction: number;
  };
  trends: {
    usageTrend: number;
    qualityTrend: number;
    costTrend: number;
  };
  topVariables: Array<{
    name: string;
    usageCount: number;
    averageValue: string;
  }>;
}

export interface PromptRenderResult {
  prompt: string;
  metadata: {
    tokensUsed: number;
    variablesReplaced: string[];
    processingTime: number;
  };
}

export interface PromptValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface PromptOptimizationOptions {
  algorithm?: 'genetic' | 'hill_climbing' | 'simulated_annealing';
  targetMetrics?: string[];
  maxIterations?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
}

export interface PromptOptimizationResult {
  optimizedTemplate: PromptTemplate;
  improvement: number;
  metricsBefore: Record<string, number>;
  metricsAfter: Record<string, number>;
  optimizationPath: OptimizationStep[];
}

export interface OptimizationStep {
  iteration: number;
  template: string;
  metrics: Record<string, number>;
  improvement: number;
}
