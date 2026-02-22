import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { 
  PromptTemplate, 
  PromptExecution, 
  PromptAnalytics,
  ABTest,
  OptimizationRecord,
  PromptRenderResult,
  PromptValidationResult,
  PromptOptimizationOptions,
  PromptOptimizationResult
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
    setInterval(() => {
      this.processOptimizationQueue();
    }, 86400000); // 24 heures

    // Traitement par lot des exécutions
    setInterval(() => {
      this.flushExecutionBuffer();
    }, 60000); // 1 minute
  }

  async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Validation du template
    await this.validateTemplate(template as PromptTemplate);

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
      tokens: rendered.metadata.tokensUsed
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
        abTestVariant: variant || undefined,
        createdAt: new Date()
      };

      // Ajout au buffer pour traitement asynchrone
      this.executionBuffer.push(execution);

      // Mise à jour des stats du template
      await this.updateTemplateStats(templateId, execution);

      // Évaluation de la qualité (async)
      this.evaluateQuality(execution).catch((err: unknown) => logger.error('Quality evaluation failed', { error: err }));

      return {
        execution,
        response: response.content,
        metrics: execution.metrics
      };

    } catch (error) {
      // Enregistrement de l'erreur
      await this.recordExecutionError(templateId, variables, error as Error, context);
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

  async optimizeTemplate(templateId: string, options: PromptOptimizationOptions = {}): Promise<OptimizationRecord> {
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
    if (!template.name || !template.template) {
      throw new Error('Template name and content are required');
    }

    if (template.template.length > 10000) {
      throw new Error('Template too long');
    }

    if (template.variables.length > 50) {
      throw new Error('Too many variables');
    }

    // Validation syntaxique du template
    try {
      await this.renderer.validateSyntax(template.template, template.variables);
    } catch (error) {
      throw new Error(`Template syntax error: ${(error as Error).message}`);
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

  private validateVariableValue(variable: any, value: any): void {
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
    const changes: any[] = [];

    if (oldTemplate.template !== newTemplate.template) {
      changes.push({
        type: 'template',
        field: 'template',
        oldValue: oldTemplate.template,
        newValue: newTemplate.template,
        reason: 'Template content updated'
      });
    }

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
    return null; // Simplifié pour l'exemple
  }

  private async executeWithLLM(templateId: string, prompt: string, context: any): Promise<any> {
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
      logger.error(`Optimization failed for template ${templateId}:`, error);
      this.optimizationQueue.push(templateId);
    }
  }

  private async getTopVariables(templateId: string, period: { start: Date; end: Date }): Promise<any[]> {
    return [];
  }

  private async validateABTest(test: ABTest): Promise<void> {
    // Validation de base
    if (!test.name || !test.variants || test.variants.length < 2) {
      throw new Error('AB test must have at least 2 variants');
    }
  }

  private async saveABTest(test: ABTest): Promise<void> {
    await this.db.query(`
      INSERT INTO ab_tests (
        id, name, description, status, variants, traffic_split,
        start_date, end_date, sample_size, confidence, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      test.id,
      test.name,
      test.description,
      test.status,
      JSON.stringify(test.variants),
      JSON.stringify(test.trafficSplit),
      test.startDate,
      test.endDate,
      test.sampleSize,
      test.confidence,
      test.createdAt
    ]);
  }

  private async startABTest(testId: string): Promise<void> {
    await this.db.query(`
      UPDATE ab_tests 
      SET status = 'running', start_date = NOW()
      WHERE id = $1
    `, [testId]);
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
