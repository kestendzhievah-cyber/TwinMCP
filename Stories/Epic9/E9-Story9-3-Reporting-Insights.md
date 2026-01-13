# E9-Story9-3-Reporting-Insights.md

## Epic 9: Analytics & Monitoring

### Story 9.3: Reporting et insights

**Description**: Génération de rapports et insights business intelligents

---

## Objectif

Développer un système complet de reporting pour générer des rapports personnalisés, des insights business automatisés et des recommandations actionnables basées sur les données analytics.

---

## Prérequis

- Analytics d'utilisation (Story 9.1) opérationnel
- Monitoring de performance (Story 9.2) en place
- Base de données analytics configurée
- Service de génération de rapports

---

## Spécifications Techniques

### 1. Architecture de Reporting

#### 1.1 Types et Interfaces

```typescript
// src/types/reporting.types.ts
export interface Report {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  category: ReportCategory;
  frequency: ReportFrequency;
  status: 'draft' | 'scheduled' | 'generating' | 'completed' | 'failed';
  config: ReportConfig;
  schedule?: ReportSchedule;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
  recipients: ReportRecipient[];
  output: ReportOutput;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
    tags: string[];
  };
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  category: 'analytics' | 'performance' | 'business' | 'compliance' | 'custom';
  template: ReportTemplate;
  requiredData: string[];
  outputFormats: ReportFormat[];
}

export interface ReportCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface ReportFrequency {
  type: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval?: number;
  timezone: string;
}

export interface ReportConfig {
  period: {
    start: Date;
    end: Date;
    dynamic?: boolean;
    relative?: string; // ex: "last_30_days"
  };
  filters: ReportFilter[];
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  visualizations: ReportVisualization[];
  insights: {
    enabled: boolean;
    types: InsightType[];
    threshold: number;
  };
  output: {
    format: ReportFormat;
    template?: string;
    branding: boolean;
    watermark?: boolean;
  };
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains';
  value: any;
  label?: string;
}

export interface ReportMetric {
  id: string;
  name: string;
  formula?: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'percentile';
  format: 'number' | 'percentage' | 'currency' | 'duration';
  precision?: number;
}

export interface ReportDimension {
  id: string;
  name: string;
  field: string;
  type: 'categorical' | 'temporal' | 'numerical';
  hierarchy?: string[];
}

export interface ReportVisualization {
  id: string;
  type: 'table' | 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge';
  title: string;
  metrics: string[];
  dimensions: string[];
  options: VisualizationOptions;
}

export interface VisualizationOptions {
  colors?: string[];
  legend?: boolean;
  grid?: boolean;
  axes?: {
    x?: AxisOptions;
    y?: AxisOptions;
  };
  tooltip?: boolean;
  animation?: boolean;
}

export interface AxisOptions {
  title?: string;
  format?: string;
  min?: number;
  max?: number;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: ReportFrequency;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
  };
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
  };
}

export interface ReportRecipient {
  id: string;
  type: 'user' | 'group' | 'email' | 'webhook';
  address: string;
  permissions: {
    view: boolean;
    edit: boolean;
    share: boolean;
  };
}

export interface ReportOutput {
  format: ReportFormat;
  url?: string;
  size?: number;
  pages?: number;
  generatedAt?: Date;
  expiresAt?: Date;
  downloadCount?: number;
}

export interface ReportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  template: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  layout: TemplateLayout;
  sections: TemplateSection[];
  styling: TemplateStyling;
}

export interface TemplateLayout {
  type: 'single-page' | 'multi-page' | 'dashboard';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface TemplateSection {
  id: string;
  type: 'header' | 'content' | 'chart' | 'table' | 'footer';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  content: any;
  styling: SectionStyling;
}

export interface TemplateStyling {
  theme: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  logo?: string;
  footer?: string;
}

export interface SectionStyling {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  data: InsightData;
  recommendations: InsightRecommendation[];
  timestamp: Date;
  reportId?: string;
}

export interface InsightType {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'anomaly' | 'correlation' | 'opportunity' | 'risk';
  algorithm: string;
  parameters: Record<string, any>;
}

export interface InsightData {
  metric: string;
  value: number;
  baseline: number;
  change: number;
  changePercent: number;
  period: string;
  significance: number;
  context: Record<string, any>;
}

export interface InsightRecommendation {
  id: string;
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeline?: string;
  resources?: string[];
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  type: 'operational' | 'analytical' | 'strategic';
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  refreshInterval: number;
  permissions: DashboardPermissions;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
  };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'kpi' | 'text' | 'image';
  title: string;
  query: string;
  visualization: WidgetVisualization;
  position: WidgetPosition;
  refreshInterval?: number;
  interactions: WidgetInteraction[];
}

export interface WidgetVisualization {
  type: string;
  options: Record<string, any>;
  colors?: string[];
  thresholds?: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetInteraction {
  type: 'click' | 'hover' | 'filter' | 'drill-down';
  action: string;
  target?: string;
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'select' | 'date' | 'range' | 'text';
  field: string;
  options?: string[];
  defaultValue?: any;
  required?: boolean;
}

export interface DashboardPermissions {
  view: string[];
  edit: string[];
  share: string[];
  public: boolean;
}

export interface ReportGeneration {
  id: string;
  reportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    percentage: number;
    currentStep: string;
    estimatedTime?: number;
  };
  config: ReportConfig;
  data: any;
  output: ReportOutput;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}
```

#### 1.2 Service de Reporting Principal

```typescript
// src/services/reporting.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { 
  Report,
  Insight,
  Dashboard,
  ReportGeneration,
  ReportConfig
} from '../types/reporting.types';
import { ReportGenerator } from './report-generator.service';
import { InsightEngine } from './insight-engine.service';
import { DashboardRenderer } from './dashboard-renderer.service';

export class ReportingService {
  private activeGenerations: Map<string, ReportGeneration> = new Map();
  private scheduledReports: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private reportGenerator: ReportGenerator,
    private insightEngine: InsightEngine,
    private dashboardRenderer: DashboardRenderer
  ) {
    this.initializeScheduledReports();
  }

  async createReport(report: Omit<Report, 'id' | 'metadata'>): Promise<Report> {
    const fullReport: Report = {
      ...report,
      id: crypto.randomUUID(),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        tags: []
      }
    };

    await this.saveReport(fullReport);

    // Configuration du scheduling si nécessaire
    if (report.schedule?.enabled) {
      this.scheduleReport(fullReport);
    }

    return fullReport;
  }

  async generateReport(
    reportId: string,
    options?: {
      format?: string;
      filters?: ReportFilter[];
      email?: boolean;
    }
  ): Promise<ReportGeneration> {
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const generationId = crypto.randomUUID();
    const generation: ReportGeneration = {
      id: generationId,
      reportId,
      status: 'pending',
      progress: {
        percentage: 0,
        currentStep: 'Initialization'
      },
      config: {
        ...report.config,
        filters: options?.filters || report.config.filters
      },
      data: null,
      output: {
        format: options?.format || report.config.output.format,
        generatedAt: new Date()
      },
      startedAt: new Date()
    };

    this.activeGenerations.set(generationId, generation);

    // Démarrage de la génération asynchrone
    this.processReportGeneration(generationId).catch(console.error);

    return generation;
  }

  async getGenerationStatus(generationId: string): Promise<ReportGeneration | null> {
    const generation = this.activeGenerations.get(generationId);
    if (generation) {
      return generation;
    }

    // Recherche en base pour les générations terminées
    const result = await this.db.query(
      'SELECT * FROM report_generations WHERE id = $1',
      [generationId]
    );

    return result.rows[0] || null;
  }

  async generateInsights(
    reportId: string,
    data: any
  ): Promise<Insight[]> {
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    if (!report.config.insights.enabled) {
      return [];
    }

    const insights: Insight[] = [];

    // Génération des insights par type
    for (const insightType of report.config.insights.types) {
      try {
        const typeInsights = await this.insightEngine.generateInsights(
          insightType,
          data,
          report.config
        );
        insights.push(...typeInsights);
      } catch (error) {
        console.error(`Error generating insights for type ${insightType.id}:`, error);
      }
    }

    // Filtrage par seuil de confiance
    const filteredInsights = insights.filter(
      insight => insight.confidence >= report.config.insights.threshold
    );

    // Tri par impact et confiance
    filteredInsights.sort((a, b) => {
      const scoreA = this.calculateInsightScore(a);
      const scoreB = this.calculateInsightScore(b);
      return scoreB - scoreA;
    });

    // Sauvegarde des insights
    await this.saveInsights(filteredInsights);

    return filteredInsights;
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'metadata'>): Promise<Dashboard> {
    const fullDashboard: Dashboard = {
      ...dashboard,
      id: crypto.randomUUID(),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: dashboard.permissions.edit[0] || 'system',
        tags: []
      }
    };

    await this.saveDashboard(fullDashboard);

    return fullDashboard;
  }

  async renderDashboard(
    dashboardId: string,
    filters?: Record<string, any>
  ): Promise<any> {
    const dashboard = await this.getDashboard(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    return await this.dashboardRenderer.render(dashboard, filters);
  }

  async getReportTemplates(category?: string): Promise<any[]> {
    let whereClause = '';
    const params: any[] = [];

    if (category) {
      whereClause = 'WHERE category = $1';
      params.push(category);
    }

    const result = await this.db.query(`
      SELECT * FROM report_templates
      ${whereClause}
      ORDER BY name
    `, params);

    return result.rows;
  }

  async getInsights(
    filters?: {
      type?: string;
      severity?: string;
      period?: { start: Date; end: Date };
      reportId?: string;
    }
  ): Promise<Insight[]> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.type) {
      whereClause += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.severity) {
      whereClause += ` AND severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }

    if (filters?.period) {
      whereClause += ` AND timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(filters.period.start, filters.period.end);
      paramIndex += 2;
    }

    if (filters?.reportId) {
      whereClause += ` AND report_id = $${paramIndex}`;
      params.push(filters.reportId);
      paramIndex++;
    }

    const result = await this.db.query(`
      SELECT * FROM insights
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT 100
    `, params);

    return result.rows.map(row => this.mapRowToInsight(row));
  }

  private async processReportGeneration(generationId: string): Promise<void> {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) return;

    try {
      // Étape 1: Collecte des données
      generation.status = 'processing';
      generation.progress.currentStep = 'Collecting data';
      generation.progress.percentage = 10;
      await this.updateGeneration(generation);

      const data = await this.collectReportData(generation.config);
      generation.data = data;

      // Étape 2: Génération des insights
      generation.progress.currentStep = 'Generating insights';
      generation.progress.percentage = 30;
      await this.updateGeneration(generation);

      const insights = await this.generateInsights(generation.reportId, data);

      // Étape 3: Génération du rapport
      generation.progress.currentStep = 'Generating report';
      generation.progress.percentage = 60;
      await this.updateGeneration(generation);

      const output = await this.reportGenerator.generate({
        config: generation.config,
        data,
        insights
      });

      generation.output = output;
      generation.progress.currentStep = 'Finalizing';
      generation.progress.percentage = 90;
      await this.updateGeneration(generation);

      // Étape 4: Finalisation
      generation.status = 'completed';
      generation.progress.percentage = 100;
      generation.progress.currentStep = 'Completed';
      generation.completedAt = new Date();

      await this.updateGeneration(generation);

      // Nettoyage
      this.activeGenerations.delete(generationId);

      // Notification
      this.notifyReportCompletion(generation);

    } catch (error) {
      generation.status = 'failed';
      generation.error = error.message;
      generation.progress.currentStep = 'Failed';
      await this.updateGeneration(generation);

      this.activeGenerations.delete(generationId);
      this.notifyReportError(generation, error);
    }
  }

  private async collectReportData(config: ReportConfig): Promise<any> {
    // Implémentation de la collecte des données basée sur la configuration
    const data = {
      metrics: {},
      dimensions: {},
      series: []
    };

    // Collecte des métriques
    for (const metric of config.metrics) {
      data.metrics[metric.id] = await this.calculateMetric(metric, config.period);
    }

    // Collecte des dimensions
    for (const dimension of config.dimensions) {
      data.dimensions[dimension.id] = await this.getDimensionData(dimension, config.period);
    }

    return data;
  }

  private async calculateMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul de métrique
    switch (metric.aggregation) {
      case 'count':
        return await this.countMetric(metric, period);
      case 'sum':
        return await this.sumMetric(metric, period);
      case 'avg':
        return await this.avgMetric(metric, period);
      default:
        return 0;
    }
  }

  private async countMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du comptage
    return 100; // Placeholder
  }

  private async sumMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation de la somme
    return 1000; // Placeholder
  }

  private async avgMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation de la moyenne
    return 50; // Placeholder
  }

  private async getDimensionData(dimension: any, period: { start: Date; end: Date }): Promise<any[]> {
    // Implémentation de la récupération des données de dimension
    return []; // Placeholder
  }

  private calculateInsightScore(insight: Insight): number {
    const impactScore = {
      'low': 1,
      'medium': 2,
      'high': 3
    }[insight.impact];

    const severityScore = {
      'info': 1,
      'warning': 2,
      'critical': 3
    }[insight.severity];

    return (insight.confidence * 0.4) + (impactScore * 0.3) + (severityScore * 0.3);
  }

  private scheduleReport(report: Report): void {
    if (!report.schedule?.enabled) return;

    const schedule = report.schedule;
    const interval = this.calculateInterval(schedule.frequency);

    const timeout = setTimeout(() => {
      this.executeScheduledReport(report);
    }, interval);

    this.scheduledReports.set(report.id, timeout);
  }

  private calculateInterval(frequency: ReportFrequency): number {
    const now = new Date();
    
    switch (frequency.type) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 1 jour
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 1 semaine
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 1 mois
      default:
        return 24 * 60 * 60 * 1000; // 1 jour par défaut
    }
  }

  private async executeScheduledReport(report: Report): Promise<void> {
    try {
      await this.generateReport(report.id, { email: true });
      
      // Rescheduling pour la prochaine exécution
      this.scheduleReport(report);
    } catch (error) {
      console.error(`Error executing scheduled report ${report.id}:`, error);
      
      // Retry logic
      if (report.schedule?.retryPolicy.maxRetries > 0) {
        setTimeout(() => {
          this.executeScheduledReport(report);
        }, report.schedule.retryPolicy.retryDelay);
      }
    }
  }

  private async notifyReportCompletion(generation: ReportGeneration): Promise<void> {
    const report = await this.getReport(generation.reportId);
    if (!report) return;

    for (const recipient of report.recipients) {
      if (recipient.type === 'email') {
        await this.sendEmailNotification(recipient.address, {
          type: 'report_completed',
          reportName: report.name,
          downloadUrl: generation.output.url,
          generatedAt: generation.completedAt
        });
      }
    }
  }

  private async notifyReportError(generation: ReportGeneration, error: Error): Promise<void> {
    const report = await this.getReport(generation.reportId);
    if (!report) return;

    for (const recipient of report.recipients) {
      if (recipient.type === 'email' && report.schedule?.notifications.onFailure) {
        await this.sendEmailNotification(recipient.address, {
          type: 'report_failed',
          reportName: report.name,
          error: error.message,
          failedAt: new Date()
        });
      }
    }
  }

  private async sendEmailNotification(email: string, data: any): Promise<void> {
    // Implémentation de l'envoi d'email
    console.log(`Sending email to ${email}:`, data);
  }

  private initializeScheduledReports(): void {
    // Chargement des rapports scheduled au démarrage
    this.loadScheduledReports().catch(console.error);
  }

  private async loadScheduledReports(): Promise<void> {
    const result = await this.db.query(`
      SELECT * FROM reports 
      WHERE schedule->>'enabled' = 'true'
    `);

    for (const row of result.rows) {
      const report = this.mapRowToReport(row);
      this.scheduleReport(report);
    }
  }

  // Méthodes de persistance
  private async saveReport(report: Report): Promise<void> {
    await this.db.query(`
      INSERT INTO reports (
        id, name, description, type, category, frequency, status,
        config, schedule, last_run, next_run, created_by, recipients,
        output, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        schedule = EXCLUDED.schedule,
        metadata = EXCLUDED.metadata
    `, [
      report.id,
      report.name,
      report.description,
      JSON.stringify(report.type),
      JSON.stringify(report.category),
      JSON.stringify(report.frequency),
      report.status,
      JSON.stringify(report.config),
      JSON.stringify(report.schedule),
      report.lastRun,
      report.nextRun,
      report.createdBy,
      JSON.stringify(report.recipients),
      JSON.stringify(report.output),
      JSON.stringify(report.metadata)
    ]);
  }

  private async updateGeneration(generation: ReportGeneration): Promise<void> {
    await this.db.query(`
      INSERT INTO report_generations (
        id, report_id, status, progress, config, data, output,
        error, started_at, completed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        data = EXCLUDED.data,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        completed_at = EXCLUDED.completed_at
    `, [
      generation.id,
      generation.reportId,
      generation.status,
      JSON.stringify(generation.progress),
      JSON.stringify(generation.config),
      JSON.stringify(generation.data),
      JSON.stringify(generation.output),
      generation.error,
      generation.startedAt,
      generation.completedAt
    ]);
  }

  private async saveInsights(insights: Insight[]): Promise<void> {
    if (insights.length === 0) return;

    const values = insights.map(insight => [
      insight.id,
      insight.type.id,
      insight.title,
      insight.description,
      insight.severity,
      insight.confidence,
      insight.impact,
      JSON.stringify(insight.data),
      JSON.stringify(insight.recommendations),
      insight.timestamp,
      insight.reportId
    ]);

    await this.db.query(`
      INSERT INTO insights (
        id, type, title, description, severity, confidence, impact,
        data, recommendations, timestamp, report_id
      ) VALUES ${values.map((_, i) => 
        `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10}, $${i * 10 + 11})`
      ).join(', ')}
    `, values.flat());
  }

  private async saveDashboard(dashboard: Dashboard): Promise<void> {
    await this.db.query(`
      INSERT INTO dashboards (
        id, name, description, type, layout, widgets, filters,
        refresh_interval, permissions, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        layout = EXCLUDED.layout,
        widgets = EXCLUDED.widgets,
        filters = EXCLUDED.filters,
        refresh_interval = EXCLUDED.refresh_interval,
        permissions = EXCLUDED.permissions,
        metadata = EXCLUDED.metadata
    `, [
      dashboard.id,
      dashboard.name,
      dashboard.description,
      dashboard.type,
      JSON.stringify(dashboard.layout),
      JSON.stringify(dashboard.widgets),
      JSON.stringify(dashboard.filters),
      dashboard.refreshInterval,
      JSON.stringify(dashboard.permissions),
      JSON.stringify(dashboard.metadata)
    ]);
  }

  private async getReport(reportId: string): Promise<Report | null> {
    const result = await this.db.query(
      'SELECT * FROM reports WHERE id = $1',
      [reportId]
    );

    return result.rows[0] ? this.mapRowToReport(result.rows[0]) : null;
  }

  private async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    const result = await this.db.query(
      'SELECT * FROM dashboards WHERE id = $1',
      [dashboardId]
    );

    return result.rows[0] ? this.mapRowToDashboard(result.rows[0]) : null;
  }

  private mapRowToReport(row: any): Report {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: JSON.parse(row.type),
      category: JSON.parse(row.category),
      frequency: JSON.parse(row.frequency),
      status: row.status,
      config: JSON.parse(row.config),
      schedule: JSON.parse(row.schedule),
      lastRun: row.last_run,
      nextRun: row.next_run,
      createdBy: row.created_by,
      recipients: JSON.parse(row.recipients),
      output: JSON.parse(row.output),
      metadata: JSON.parse(row.metadata)
    };
  }

  private mapRowToDashboard(row: any): Dashboard {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      layout: JSON.parse(row.layout),
      widgets: JSON.parse(row.widgets),
      filters: JSON.parse(row.filters),
      refreshInterval: row.refresh_interval,
      permissions: JSON.parse(row.permissions),
      metadata: JSON.parse(row.metadata)
    };
  }

  private mapRowToInsight(row: any): Insight {
    return {
      id: row.id,
      type: { id: row.type }, // Simplifié
      title: row.title,
      description: row.description,
      severity: row.severity,
      confidence: row.confidence,
      impact: row.impact,
      data: JSON.parse(row.data),
      recommendations: JSON.parse(row.recommendations),
      timestamp: row.timestamp,
      reportId: row.report_id
    };
  }
}
```

---

## Tâches Détaillées

### 1. Service de Reporting
- [ ] Implémenter ReportingService
- [ ] Créer ReportGenerator
- [ ] Développer InsightEngine
- [ ] Ajouter DashboardRenderer

### 2. Génération de Rapports
- [ ] Implémenter les templates de rapports
- [ ] Créer le moteur de génération
- [ ] Ajouter les exports multi-formats
- [ ] Développer le scheduling

### 3. Insights Automatisés
- [ ] Développer les algorithmes d'insights
- [ ] Créer la détection d'anomalies
- [ ] Ajouter les recommandations
- [ ] Implémenter le scoring

### 4. Dashboards Interactifs
- [ ] Créer le moteur de dashboards
- [ ] Développer les widgets
- [ ] Ajouter les filtres dynamiques
- [ ] Implémenter le temps réel

---

## Validation

### Tests du Service

```typescript
// __tests__/reporting.service.test.ts
describe('ReportingService', () => {
  let service: ReportingService;

  beforeEach(() => {
    service = new ReportingService(
      mockDb,
      mockRedis,
      mockReportGenerator,
      mockInsightEngine,
      mockDashboardRenderer
    );
  });

  describe('createReport', () => {
    it('should create a new report', async () => {
      const report = await service.createReport({
        name: 'Monthly Usage Report',
        description: 'Monthly usage analytics report',
        type: { id: 'usage', name: 'Usage', category: 'analytics', template: {}, requiredData: [], outputFormats: [] },
        category: { id: 'analytics', name: 'Analytics', description: '', icon: '', color: '' },
        frequency: { type: 'monthly', timezone: 'UTC' },
        status: 'draft',
        config: {
          period: { start: new Date(), end: new Date() },
          filters: [],
          metrics: [],
          dimensions: [],
          visualizations: [],
          insights: { enabled: true, types: [], threshold: 0.7 },
          output: { format: { id: 'pdf', name: 'PDF', extension: '.pdf', mimeType: 'application/pdf', template: '' }, branding: true }
        },
        createdBy: 'user123',
        recipients: [],
        output: { format: { id: 'pdf', name: 'PDF', extension: '.pdf', mimeType: 'application/pdf', template: '' } }
      });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.name).toBe('Monthly Usage Report');
    });
  });

  describe('generateReport', () => {
    it('should start report generation', async () => {
      const generation = await service.generateReport('report123', {
        format: 'pdf',
        email: true
      });

      expect(generation).toBeDefined();
      expect(generation.status).toBe('pending');
      expect(generation.reportId).toBe('report123');
    });
  });
});
```

---

## Architecture

### Composants

1. **ReportingService**: Service principal
2. **ReportGenerator**: Générateur de rapports
3. **InsightEngine**: Moteur d'insights
4. **DashboardRenderer**: Moteur de dashboards
5. **TemplateEngine**: Moteur de templates

### Flux de Reporting

```
Report Definition → Data Collection → Insight Generation → Report Rendering → Distribution
```

---

## Performance

### Optimisations

- **Async Processing**: Traitement asynchrone
- **Data Caching**: Cache des données
- **Template Optimization**: Optimisation des templates
- **Incremental Updates**: Mises à jour incrémentales

### Métriques Cibles

- **Report Generation**: < 30 secondes
- **Dashboard Load**: < 2 secondes
- **Insight Generation**: < 10 secondes
- **Data Collection**: < 5 secondes

---

## Monitoring

### Métriques

- `reporting.reports.created`: Rapports créés
- `reporting.generations.total`: Générations lancées
- `reporting.insights.generated`: Insights générés
- `reporting.dashboards.views`: Vues des dashboards
- `reporting.exports.downloaded`: Exports téléchargés

---

## Livrables

1. **ReportingService**: Service complet
2. **Report Templates**: Templates de rapports
3. **Insight Engine**: Moteur d'insights
4. **Dashboard System**: Système de dashboards
5. **Export System**: Système d'exports

---

## Critères de Succès

- [ ] Reporting automatisé fonctionnel
- [ ] Insights pertinents générés
- [ ] Dashboards interactifs
- [ ] Exports multi-formats
- [ ] Performance < 30s
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Report Usage**: Analyse de l'utilisation
2. **Insight Accuracy**: Précision des insights
3. **User Engagement**: Engagement utilisateur
4. **Business Impact**: Impact business
