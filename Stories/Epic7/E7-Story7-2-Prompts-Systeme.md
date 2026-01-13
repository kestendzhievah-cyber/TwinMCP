# E7-Story7-2-Prompts-Systeme.md

## Epic 7: LLM Integration

### Story 7.2: Système de prompts

**Description**: Templates et gestion des prompts optimisés

---

## Objectif

Développer un système complet de gestion de prompts avec templates dynamiques, optimisation automatique, versioning et A/B testing pour maximiser la qualité des réponses LLM.

---

## Prérequis

- Service d'intégration LLM (Story 7.1) opérationnel
- Service d'assemblage de contexte (Epic 5) disponible
- Base de données pour le stockage des templates
- Système d'analytics et de monitoring

---

## Spécifications Techniques

### 1. Architecture du Système de Prompts

#### 1.1 Types et Interfaces

```typescript
// src/types/prompt-system.types.ts
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
```

#### 1.2 Configuration du Système

```typescript
// src/config/prompt-system.config.ts
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

export const DEFAULT_PROMPT_CATEGORIES: PromptCategory[] = [
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
```

### 2. Service de Gestion des Prompts

#### 2.1 Prompt Management Service

```typescript
// src/services/prompt-management.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { 
  PromptTemplate, 
  PromptExecution, 
  PromptAnalytics,
  ABTest,
  OptimizationRecord
} from '../types/prompt-system.types';
import { PromptRenderer } from './prompt-renderer.service';
import { PromptOptimizer } from './prompt-optimizer.service';
import { PromptTester } from './prompt-tester.service';

export class PromptManagementService extends EventEmitter {
  private templateCache: Map<string, PromptTemplate> = new Map();
  private executionBuffer: PromptExecution[] = [];
  private optimizationQueue: string[] = [];

  constructor(
    private db: Pool,
    private redis: Redis,
    private renderer: PromptRenderer,
    private optimizer: PromptOptimizer,
    private tester: PromptTester
  ) {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    // Démarrage de l'optimisation automatique
    if (PROMPT_SYSTEM_CONFIG.optimization.enabled) {
      setInterval(() => {
        this.processOptimizationQueue();
      }, PROMPT_SYSTEM_CONFIG.optimization.interval);
    }

    // Traitement par lot des exécutions
    setInterval(() => {
      this.flushExecutionBuffer();
    }, 60000); // 1 minute
  }

  async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Validation du template
    await this.validateTemplate(template);

    const id = crypto.randomUUID();
    const now = new Date();

    const fullTemplate: PromptTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...template.metadata,
        estimatedTokens: this.estimateTokens(template.template),
        usageCount: 0,
        successRate: 0,
        averageRating: 0
      }
    };

    // Sauvegarde en base
    await this.saveTemplate(fullTemplate);

    // Mise en cache
    this.templateCache.set(id, fullTemplate);

    // Événement
    this.emit('template_created', fullTemplate);

    return id;
  }

  async getTemplate(templateId: string, version?: string): Promise<PromptTemplate | null> {
    // Vérification du cache
    if (!version && this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }

    // Recherche en base
    const result = await this.db.query(
      version 
        ? 'SELECT * FROM prompt_templates WHERE id = $1 AND version = $2'
        : 'SELECT * FROM prompt_templates WHERE id = $1 AND status = \'active\'',
      version ? [templateId, version] : [templateId]
    );

    if (result.rows.length === 0) return null;

    const template = this.mapRowToTemplate(result.rows[0]);

    if (!version) {
      this.templateCache.set(templateId, template);
    }

    return template;
  }

  async updateTemplate(
    templateId: string, 
    updates: Partial<PromptTemplate>
  ): Promise<PromptTemplate> {
    const existing = await this.getTemplate(templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Création d'une nouvelle version
    const newVersion = this.incrementVersion(existing.version);
    
    const updated: PromptTemplate = {
      ...existing,
      ...updates,
      version: newVersion,
      updatedAt: new Date(),
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        lastUpdated: new Date()
      }
    };

    // Validation
    await this.validateTemplate(updated);

    // Sauvegarde
    await this.saveTemplate(updated);

    // Mise à jour du cache
    this.templateCache.set(templateId, updated);

    // Historisation des changements
    await this.recordVersionChange(existing, updated);

    // Événement
    this.emit('template_updated', updated);

    return updated;
  }

  async renderPrompt(
    templateId: string, 
    variables: Record<string, any>,
    options: {
      validateVariables?: boolean;
      includeMetadata?: boolean;
      context?: any;
    } = {}
  ): Promise<{
    rendered: string;
    metadata: any;
    tokens: number;
  }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validation des variables
    if (options.validateVariables !== false) {
      await this.validateVariables(template, variables);
    }

    // Rendu
    const rendered = await this.renderer.render(template, variables, options.context);

    return {
      rendered: rendered.prompt,
      metadata: rendered.metadata,
      tokens: rendered.tokens
    };
  }

  async executePrompt(
    templateId: string,
    variables: Record<string, any>,
    context: {
      model: string;
      provider: string;
      userId?: string;
      sessionId?: string;
      abTestVariant?: string;
    }
  ): Promise<{
    execution: PromptExecution;
    response: string;
    metrics: any;
  }> {
    const startTime = Date.now();

    try {
      // Rendu du prompt
      const { rendered, metadata, tokens } = await this.renderPrompt(templateId, variables);

      // Vérification A/B testing
      const variant = await this.getABTestVariant(templateId, context.abTestVariant);
      const actualTemplateId = variant || templateId;

      // Exécution (via LLM service)
      const response = await this.executeWithLLM(actualTemplateId, rendered, context);

      // Enregistrement de l'exécution
      const execution: PromptExecution = {
        id: crypto.randomUUID(),
        templateId,
        templateVersion: (await this.getTemplate(templateId))!.version,
        variables,
        renderedPrompt: rendered,
        context,
        model: context.model,
        provider: context.provider,
        response: response.content,
        metrics: {
          promptTokens: tokens,
          responseTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          latency: Date.now() - startTime,
          cost: response.cost
        },
        quality: {
          relevance: 0, // Calculé plus tard
          coherence: 0,
          completeness: 0
        },
        abTestVariant: variant,
        createdAt: new Date()
      };

      // Ajout au buffer pour traitement asynchrone
      this.executionBuffer.push(execution);

      // Mise à jour des stats du template
      await this.updateTemplateStats(templateId, execution);

      // Évaluation de la qualité (async)
      this.evaluateQuality(execution).catch(console.error);

      return {
        execution,
        response: response.content,
        metrics: execution.metrics
      };

    } catch (error) {
      // Enregistrement de l'erreur
      await this.recordExecutionError(templateId, variables, error, context);
      throw error;
    }
  }

  async getAnalytics(templateId: string, period: { start: Date; end: Date }): Promise<PromptAnalytics> {
    const result = await this.db.query(`
      WITH executions AS (
        SELECT 
          pe.*,
          pt.name as template_name,
          pt.category
        FROM prompt_executions pe
        JOIN prompt_templates pt ON pe.template_id = pt.id
        WHERE pe.template_id = $1 
          AND pe.created_at BETWEEN $2 AND $3
      ),
      metrics AS (
        SELECT 
          COUNT(*) as total_executions,
          COUNT(DISTINCT pe.user_id) as unique_users,
          AVG(pe.metrics->>'latency')::float as avg_latency,
          COUNT(CASE WHEN pe.response IS NOT NULL THEN 1 END)::float / COUNT(*) as success_rate,
          AVG(pe.metrics->>'totalTokens')::float as avg_tokens,
          AVG(pe.metrics->>'cost')::float as avg_cost,
          AVG(pe.quality->>'relevance')::float as avg_relevance,
          AVG(pe.quality->>'coherence')::float as avg_coherence,
          AVG(pe.quality->>'completeness')::float as avg_completeness,
          AVG(pe.quality->>'userRating')::float as avg_rating
        FROM executions pe
      )
      SELECT 
        m.*,
        -- Calcul des trends (comparaison avec période précédente)
        0 as usage_trend,
        0 as quality_trend,
        0 as cost_trend
      FROM metrics m
    `, [templateId, period.start, period.end]);

    const stats = result.rows[0];

    // Top variables
    const topVars = await this.getTopVariables(templateId, period);

    return {
      templateId,
      period,
      usage: {
        totalExecutions: parseInt(stats.total_executions),
        uniqueUsers: parseInt(stats.unique_users),
        averageLatency: parseFloat(stats.avg_latency),
        successRate: parseFloat(stats.success_rate),
        errorRate: 1 - parseFloat(stats.success_rate)
      },
      performance: {
        averageTokens: parseFloat(stats.avg_tokens),
        averageCost: parseFloat(stats.avg_cost),
        qualityScore: (parseFloat(stats.avg_relevance) + parseFloat(stats.avg_coherence) + parseFloat(stats.avg_completeness)) / 3,
        userSatisfaction: parseFloat(stats.avg_rating) || 0
      },
      trends: {
        usageTrend: stats.usage_trend,
        qualityTrend: stats.quality_trend,
        costTrend: stats.cost_trend
      },
      topVariables: topVars
    };
  }

  async createABTest(test: Omit<ABTest, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();

    const fullTest: ABTest = {
      ...test,
      id,
      createdAt: now
    };

    // Validation du test
    await this.validateABTest(fullTest);

    // Sauvegarde
    await this.saveABTest(fullTest);

    // Démarrage si nécessaire
    if (test.status === 'running') {
      await this.startABTest(id);
    }

    return id;
  }

  async optimizeTemplate(templateId: string, options: {
    algorithm?: 'genetic' | 'hill_climbing' | 'simulated_annealing';
    targetMetrics?: string[];
    maxIterations?: number;
  } = {}): Promise<OptimizationRecord> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Vérification que l'optimisation est activée
    if (!template.optimization.autoOptimize) {
      throw new Error(`Optimization not enabled for template ${templateId}`);
    }

    // Ajout à la queue d'optimisation
    this.optimizationQueue.push(templateId);

    // Lancement de l'optimisation
    return await this.optimizer.optimize(template, options);
  }

  private async validateTemplate(template: PromptTemplate): Promise<void> {
    // Validation des champs requis
    if (!template.name || !template.template) {
      throw new Error('Template name and content are required');
    }

    // Validation de la longueur
    if (template.template.length > PROMPT_SYSTEM_CONFIG.templates.maxTemplateLength) {
      throw new Error('Template too long');
    }

    // Validation des variables
    if (template.variables.length > PROMPT_SYSTEM_CONFIG.templates.maxVariables) {
      throw new Error('Too many variables');
    }

    // Validation des patterns interdits
    for (const pattern of PROMPT_SYSTEM_CONFIG.templates.validationRules.forbiddenPatterns) {
      if (pattern.test(template.template)) {
        throw new Error(`Template contains forbidden pattern: ${pattern}`);
      }
    }

    // Validation syntaxique du template
    try {
      await this.renderer.validateSyntax(template.template, template.variables);
    } catch (error) {
      throw new Error(`Template syntax error: ${error.message}`);
    }
  }

  private async validateVariables(template: PromptTemplate, variables: Record<string, any>): Promise<void> {
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in variables)) {
        throw new Error(`Required variable ${variable.name} is missing`);
      }

      if (variable.name in variables) {
        const value = variables[variable.name];
        this.validateVariableValue(variable, value);
      }
    }
  }

  private validateVariableValue(variable: PromptVariable, value: any): void {
    if (variable.validation) {
      const { minLength, maxLength, min, max, pattern, enum: enumValues } = variable.validation;

      if (variable.type === 'string') {
        const str = String(value);
        if (minLength && str.length < minLength) {
          throw new Error(`Variable ${variable.name} too short (min: ${minLength})`);
        }
        if (maxLength && str.length > maxLength) {
          throw new Error(`Variable ${variable.name} too long (max: ${maxLength})`);
        }
        if (pattern && !new RegExp(pattern).test(str)) {
          throw new Error(`Variable ${variable.name} does not match pattern`);
        }
      }

      if (variable.type === 'number') {
        const num = Number(value);
        if (min !== undefined && num < min) {
          throw new Error(`Variable ${variable.name} too small (min: ${min})`);
        }
        if (max !== undefined && num > max) {
          throw new Error(`Variable ${variable.name} too large (max: ${max})`);
        }
      }

      if (enumValues && !enumValues.includes(value)) {
        throw new Error(`Variable ${variable.name} must be one of: ${enumValues.join(', ')}`);
      }
    }
  }

  private estimateTokens(template: string): number {
    // Estimation simple: ~4 caractères = 1 token
    return Math.ceil(template.length / 4);
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private async saveTemplate(template: PromptTemplate): Promise<void> {
    await this.db.query(`
      INSERT INTO prompt_templates (
        id, name, description, category, version, status,
        template, variables, examples, metadata,
        constraints, optimization, testing,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (id, version) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        template = EXCLUDED.template,
        variables = EXCLUDED.variables,
        examples = EXCLUDED.examples,
        metadata = EXCLUDED.metadata,
        constraints = EXCLUDED.constraints,
        optimization = EXCLUDED.optimization,
        testing = EXCLUDED.testing,
        updated_at = EXCLUDED.updated_at
    `, [
      template.id,
      template.name,
      template.description,
      template.category,
      template.version,
      template.status,
      template.template,
      JSON.stringify(template.variables),
      JSON.stringify(template.examples),
      JSON.stringify(template.metadata),
      JSON.stringify(template.constraints),
      JSON.stringify(template.optimization),
      JSON.stringify(template.testing),
      template.createdAt,
      template.updatedAt
    ]);
  }

  private async recordVersionChange(oldTemplate: PromptTemplate, newTemplate: PromptTemplate): Promise<void> {
    const changes: PromptChange[] = [];

    // Détection des changements
    if (oldTemplate.template !== newTemplate.template) {
      changes.push({
        type: 'template',
        field: 'template',
        oldValue: oldTemplate.template,
        newValue: newTemplate.template,
        reason: 'Template content updated'
      });
    }

    // Comparaison des variables
    // ... (implémentation détaillée)

    if (changes.length > 0) {
      await this.db.query(`
        INSERT INTO template_changes (
          template_id, from_version, to_version, changes, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        oldTemplate.id,
        oldTemplate.version,
        newTemplate.version,
        JSON.stringify(changes)
      ]);
    }
  }

  private async getABTestVariant(templateId: string, preferredVariant?: string): Promise<string | null> {
    // Implémentation de la logique A/B testing
    // Retourne l'ID du variant à utiliser ou null
    return null; // Simplifié pour l'exemple
  }

  private async executeWithLLM(templateId: string, prompt: string, context: any): Promise<any> {
    // Intégration avec le LLM service
    // Implémentation à connecter avec le service LLM
    return {
      content: 'Mock response',
      usage: { completionTokens: 100, totalTokens: 200 },
      cost: 0.01
    };
  }

  private async updateTemplateStats(templateId: string, execution: PromptExecution): Promise<void> {
    await this.db.query(`
      UPDATE prompt_templates 
      SET 
        metadata = metadata || jsonb_build_object(
          'usageCount', (metadata->>'usageCount')::int + 1,
          'lastUpdated', NOW()
        )
      WHERE id = $1
    `, [templateId]);
  }

  private async evaluateQuality(execution: PromptExecution): Promise<void> {
    // Évaluation automatique de la qualité
    const quality = await this.tester.evaluateQuality(execution);
    
    await this.db.query(`
      UPDATE prompt_executions 
      SET quality = $1
      WHERE id = $2
    `, [JSON.stringify(quality), execution.id]);
  }

  private async recordExecutionError(
    templateId: string, 
    variables: Record<string, any>, 
    error: Error, 
    context: any
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO prompt_execution_errors (
        template_id, variables, error_message, context, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [templateId, JSON.stringify(variables), error.message, JSON.stringify(context)]);
  }

  private async flushExecutionBuffer(): Promise<void> {
    if (this.executionBuffer.length === 0) return;

    const executions = [...this.executionBuffer];
    this.executionBuffer = [];

    // Insertion par lot en base
    const values = executions.map(exec => [
      exec.id,
      exec.templateId,
      exec.templateVersion,
      JSON.stringify(exec.variables),
      exec.renderedPrompt,
      JSON.stringify(exec.context),
      exec.model,
      exec.provider,
      exec.response,
      JSON.stringify(exec.metrics),
      JSON.stringify(exec.quality),
      exec.abTestVariant,
      exec.createdAt
    ]);

    await this.db.query(`
      INSERT INTO prompt_executions (
        id, template_id, template_version, variables, rendered_prompt,
        context, model, provider, response, metrics, quality,
        ab_test_variant, created_at
      ) VALUES ${values.map((_, i) => `($${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, $${i * 13 + 9}, $${i * 13 + 10}, $${i * 13 + 11}, $${i * 13 + 12}, $${i * 13 + 13})`).join(', ')}
    `, values.flat());
  }

  private async processOptimizationQueue(): Promise<void> {
    if (this.optimizationQueue.length === 0) return;

    const templateId = this.optimizationQueue.shift()!;
    
    try {
      await this.optimizeTemplate(templateId);
    } catch (error) {
      console.error(`Optimization failed for template ${templateId}:`, error);
      // Remise dans la queue pour réessayer plus tard
      this.optimizationQueue.push(templateId);
    }
  }

  private async getTopVariables(templateId: string, period: { start: Date; end: Date }): Promise<any[]> {
    // Implémentation de l'analyse des variables les plus utilisées
    return [];
  }

  private mapRowToTemplate(row: any): PromptTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      version: row.version,
      status: row.status,
      template: row.template,
      variables: JSON.parse(row.variables),
      examples: JSON.parse(row.examples),
      metadata: JSON.parse(row.metadata),
      constraints: JSON.parse(row.constraints),
      optimization: JSON.parse(row.optimization),
      testing: JSON.parse(row.testing),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
```

---

## Tâches Détaillées

### 1. Service de Gestion
- [ ] Implémenter PromptManagementService
- [ ] Créer le système de versioning
- [ ] Ajouter la validation des templates
- [ ] Développer le cache intelligent

### 2. Moteur de Rendu
- [ ] Développer PromptRenderer
- [ ] Implémenter la validation syntaxique
- [ ] Ajouter le formatting des variables
- [ ] Créer le système de dépendances

### 3. Optimisation Automatique
- [ ] Implémenter PromptOptimizer
- [ ] Développer les algorithmes d'optimisation
- [ ] Ajouter le monitoring des performances
- [ ] Créer l'historique des changements

### 4. A/B Testing
- [ ] Développer le système d'A/B testing
- [ ] Implémenter l'analyse statistique
- [ ] Ajouter le routing automatique
- [ ] Créer les rapports de résultats

---

## Validation

### Tests du Système

```typescript
// __tests__/prompt-management.service.test.ts
describe('PromptManagementService', () => {
  let service: PromptManagementService;

  beforeEach(() => {
    service = new PromptManagementService(
      mockDb,
      mockRedis,
      mockRenderer,
      mockOptimizer,
      mockTester
    );
  });

  describe('createTemplate', () => {
    it('should create a valid prompt template', async () => {
      const template = {
        name: 'Test Template',
        description: 'A test template',
        category: 'chat',
        version: '1.0.0',
        status: 'draft' as const,
        template: 'Hello {{name}}, how are you?',
        variables: [
          {
            name: 'name',
            type: 'string' as const,
            description: 'User name',
            required: true,
            examples: ['John', 'Jane']
          }
        ],
        examples: [],
        metadata: {
          author: 'test',
          tags: ['test'],
          optimizedFor: ['gpt-4'],
          language: 'en',
          complexity: 'basic' as const
        },
        constraints: {
          requiredVariables: ['name'],
          forbiddenPatterns: [],
          allowedModels: ['gpt-4', 'gpt-3.5-turbo']
        },
        optimization: {
          autoOptimize: true,
          targetMetrics: [],
          optimizationHistory: []
        },
        testing: {
          abTests: [],
          testResults: []
        }
      };

      const templateId = await service.createTemplate(template);

      expect(templateId).toBeDefined();
      
      const retrieved = await service.getTemplate(templateId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Template');
    });
  });

  describe('renderPrompt', () => {
    it('should render prompt with variables', async () => {
      const templateId = 'test-template';
      
      jest.spyOn(service, 'getTemplate').mockResolvedValue({
        id: templateId,
        name: 'Test',
        template: 'Hello {{name}}!',
        variables: [
          {
            name: 'name',
            type: 'string',
            description: 'Name',
            required: true,
            examples: []
          }
        ],
        // ... autres champs requis
      } as any);

      const result = await service.renderPrompt(templateId, { name: 'World' });

      expect(result.rendered).toBe('Hello World!');
      expect(result.tokens).toBeGreaterThan(0);
    });
  });
});
```

---

## Architecture

### Composants

1. **PromptManagementService**: Service principal de gestion
2. **PromptRenderer**: Moteur de rendu des templates
3. **PromptOptimizer**: Service d'optimisation automatique
4. **PromptTester**: Service de testing et A/B testing
5. **Analytics Engine**: Analytics et métriques

### Flux d'Exécution

```
Template Selection → Variable Validation → Rendering → LLM Execution → Quality Evaluation → Analytics
```

---

## Performance

### Optimisations

- **Template Caching**: Cache intelligent des templates
- **Batch Processing**: Traitement par lot des exécutions
- **Async Quality Evaluation**: Évaluation qualité asynchrone
- **Smart Optimization**: Optimisation basée sur l'usage

### Métriques Cibles

- **Rendering Speed**: < 10ms par template
- **Execution Tracking**: < 100ms pour l'enregistrement
- **Optimization Efficiency**: > 5% d'amélioration
- **Cache Hit Rate**: > 80%

---

## Monitoring

### Métriques

- `prompt.templates.total`: Nombre total de templates
- `prompt.executions.total`: Exécutions par template
- `prompt.optimization.improvement`: Améliorations générées
- `prompt.abtest.conversions**: Taux de conversion A/B
- `prompt.quality.score`: Score de qualité moyen

---

## Livrables

1. **PromptManagementService**: Service complet
2. **Template Engine**: Moteur de rendu puissant
3. **Optimization System**: Optimisation automatique
4. **A/B Testing Framework**: Testing complet
5. **Analytics Dashboard**: Monitoring détaillé

---

## Critères de Succès

- [ ] Système de templates fonctionnel
- [ ] Rendu < 10ms
- [ ] Optimisation automatique efficace
- [ ] A/B testing statistiquement valide
- [ ] Tests avec couverture > 90%
- [ ] Documentation complète

---

## Suivi

### Post-Implémentation

1. **Quality Monitoring**: Surveillance de la qualité des prompts
2. **Performance Tuning**: Optimisation continue
3. **User Feedback**: Collecte des retours utilisateurs
4. **Template Evolution**: Amélioration basée sur l'usage
