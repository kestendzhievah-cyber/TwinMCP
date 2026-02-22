import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { 
  Report,
  Insight,
  Dashboard,
  ReportGeneration,
  ReportConfig,
  ReportFilter,
  Invoice,
  InvoiceItem
} from '../types/reporting.types';
import { ReportGenerator } from './report-generator.service';
import { InsightEngine } from './insight-engine.service';
import { DashboardRenderer } from './dashboard-renderer.service';
import { StreamingBillingService } from './streaming-billing.service';

export class ReportingService {
  private activeGenerations: Map<string, ReportGeneration> = new Map();
  private scheduledReports: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private db: Pool,
    private redis: Redis,
    private reportGenerator: ReportGenerator,
    private insightEngine: InsightEngine,
    private dashboardRenderer: DashboardRenderer,
    private billingService: StreamingBillingService
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
        format: options?.format || report.config.output.format as any,
        generatedAt: new Date()
      },
      startedAt: new Date()
    };

    this.activeGenerations.set(generationId, generation);

    this.processReportGeneration(generationId).catch((err: unknown) => logger.error('Report generation failed', { error: err }));

    return generation;
  }

  async getGenerationStatus(generationId: string): Promise<ReportGeneration | null> {
    const generation = this.activeGenerations.get(generationId);
    if (generation) {
      return generation;
    }

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

    for (const insightType of report.config.insights.types) {
      try {
        const typeInsights = await this.insightEngine.generateInsights(
          insightType,
          data,
          report.config
        );
        insights.push(...typeInsights);
      } catch (error) {
        logger.error(`Error generating insights for type ${insightType.id}:`, error);
      }
    }

    const filteredInsights = insights.filter(
      insight => insight.confidence >= report.config.insights.threshold
    );

    filteredInsights.sort((a, b) => {
      const scoreA = this.calculateInsightScore(a);
      const scoreB = this.calculateInsightScore(b);
      return scoreB - scoreA;
    });

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

    return await this.dashboardRenderer.render(dashboard as any);
  }

  async createInvoice(userId: string, period: string): Promise<Invoice> {
    const billingReport = await this.billingService.generateBillingReport(userId, period);
    
    const invoiceNumber = this.generateInvoiceNumber();
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const items: InvoiceItem[] = [
      {
        id: crypto.randomUUID(),
        description: `Streaming services - ${period}`,
        quantity: 1,
        unitPrice: billingReport.totalUsage.cost,
        amount: billingReport.totalUsage.cost,
        period
      }
    ];

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * 0.2; // 20% TVA
    const total = subtotal + tax;

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      userId,
      number: invoiceNumber,
      status: 'draft',
      issueDate,
      dueDate,
      subtotal,
      tax,
      total,
      currency: 'EUR',
      items,
      billingAddress: await this.getBillingAddress(userId),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      }
    };

    await this.saveInvoice(invoice);

    return invoice;
  }

  async getInvoices(userId: string, status?: string): Promise<Invoice[]> {
    let query = 'SELECT * FROM invoices WHERE user_id = $1';
    const params: any[] = [userId];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY issue_date DESC';

    const result = await this.db.query(query, params);

    return result.rows.map(row => this.mapRowToInvoice(row));
  }

  async updateInvoiceStatus(invoiceId: string, status: Invoice['status']): Promise<void> {
    const updateData: any = { status, updated_at: new Date() };
    
    if (status === 'paid') {
      updateData.paid_date = new Date();
    }

    await this.db.query(
      'UPDATE invoices SET status = $1, paid_date = COALESCE($2, paid_date), updated_at = $3 WHERE id = $4',
      [status, updateData.paid_date, updateData.updated_at, invoiceId]
    );
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
      generation.status = 'processing';
      generation.progress.currentStep = 'Collecting data';
      generation.progress.percentage = 10;
      await this.updateGeneration(generation);

      const data = await this.collectReportData(generation.config);
      generation.data = data;

      generation.progress.currentStep = 'Generating insights';
      generation.progress.percentage = 30;
      await this.updateGeneration(generation);

      const insights = await this.generateInsights(generation.reportId, data);

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

      generation.status = 'completed';
      generation.progress.percentage = 100;
      generation.progress.currentStep = 'Completed';
      generation.completedAt = new Date();

      await this.updateGeneration(generation);

      this.activeGenerations.delete(generationId);

      this.notifyReportCompletion(generation);

    } catch (error) {
      generation.status = 'failed';
      generation.error = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
      generation.progress.currentStep = 'Failed';
      await this.updateGeneration(generation);

      this.activeGenerations.delete(generationId);
      this.notifyReportError(generation, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async collectReportData(config: ReportConfig): Promise<any> {
    const data = {
      metrics: {} as Record<string, any>,
      dimensions: {} as Record<string, any>,
      series: []
    };

    for (const metric of config.metrics) {
      data.metrics[metric.id] = await this.calculateMetric(metric, config.period);
    }

    for (const dimension of config.dimensions) {
      data.dimensions[dimension.id] = await this.getDimensionData(dimension, config.period);
    }

    return data;
  }

  private async calculateMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
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
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM metrics WHERE timestamp BETWEEN $1 AND $2',
      [period.start, period.end]
    );
    return parseInt(result.rows[0].count);
  }

  private async sumMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
    const result = await this.db.query(
      `SELECT SUM(value) as sum FROM metrics 
       WHERE name = $1 AND timestamp BETWEEN $2 AND $3`,
      [metric.name, period.start, period.end]
    );
    return parseFloat(result.rows[0].sum) || 0;
  }

  private async avgMetric(metric: any, period: { start: Date; end: Date }): Promise<number> {
    const result = await this.db.query(
      `SELECT AVG(value) as avg FROM metrics 
       WHERE name = $1 AND timestamp BETWEEN $2 AND $3`,
      [metric.name, period.start, period.end]
    );
    return parseFloat(result.rows[0].avg) || 0;
  }

  private async getDimensionData(dimension: any, period: { start: Date; end: Date }): Promise<any[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ${dimension.field} as value, COUNT(*) as count 
       FROM events WHERE timestamp BETWEEN $1 AND $2 
       GROUP BY ${dimension.field} ORDER BY count DESC`,
      [period.start, period.end]
    );
    return result.rows;
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

  private calculateInterval(frequency: any): number {
    const now = new Date();
    
    switch (frequency.type) {
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private async executeScheduledReport(report: Report): Promise<void> {
    try {
      await this.generateReport(report.id, { email: true });
      this.scheduleReport(report);
    } catch (error) {
      logger.error(`Error executing scheduled report ${report.id}:`, error);
      
      if (report.schedule?.retryPolicy?.maxRetries && report.schedule.retryPolicy.maxRetries > 0) {
        const retryDelay = report.schedule.retryPolicy.retryDelay || 5000;
        setTimeout(() => {
          this.executeScheduledReport(report);
        }, retryDelay);
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
    logger.info(`Sending email to ${email}:`, data);
  }

  private initializeScheduledReports(): void {
    this.loadScheduledReports().catch((err: unknown) => logger.error('Failed to load scheduled reports', { error: err }));
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

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }

  private async getBillingAddress(userId: string): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        name: 'Default User',
        email: 'user@example.com',
        address: '123 Main St',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        postalCode: '75001'
      };
    }

    const profile = result.rows[0];
    return {
      name: `${profile.first_name} ${profile.last_name}`,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      postalCode: profile.postal_code
    };
  }

  async saveReport(report: Report): Promise<void> {
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

  private async saveInvoice(invoice: Invoice): Promise<void> {
    await this.db.query(`
      INSERT INTO invoices (
        id, user_id, number, status, issue_date, due_date, paid_date,
        subtotal, tax, total, currency, items, billing_address, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        paid_date = EXCLUDED.paid_date,
        metadata = EXCLUDED.metadata
    `, [
      invoice.id,
      invoice.userId,
      invoice.number,
      invoice.status,
      invoice.issueDate,
      invoice.dueDate,
      invoice.paidDate,
      invoice.subtotal,
      invoice.tax,
      invoice.total,
      invoice.currency,
      JSON.stringify(invoice.items),
      JSON.stringify(invoice.billingAddress),
      JSON.stringify(invoice.metadata)
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
        `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`
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

  async getReport(reportId: string): Promise<Report | null> {
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
      type: {
        id: row.type,
        name: row.type_name || row.type,
        description: row.type_description || '',
        category: row.type_category || 'general',
        algorithm: row.type_algorithm || 'basic',
        parameters: row.type_parameters ? JSON.parse(row.type_parameters) : {}
      },
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

  private mapRowToInvoice(row: any): Invoice {
    return {
      id: row.id,
      userId: row.user_id,
      number: row.number,
      status: row.status,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      paidDate: row.paid_date,
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      currency: row.currency,
      items: JSON.parse(row.items),
      billingAddress: JSON.parse(row.billing_address),
      metadata: JSON.parse(row.metadata)
    };
  }
}
