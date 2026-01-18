// src/services/analytics.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { 
  UserAnalytics,
  SessionAnalytics,
  SessionEvent,
  UsageMetrics,
  BehaviorPattern,
  AnalyticsInsight,
  RealTimeMetrics,
  AnalyticsFilter,
  AnalyticsQuery,
  DeviceInfo,
  BrowserInfo,
  LocationInfo,
  EventType,
  EventCategory,
  PageContext,
  UserContext,
  FunnelData,
  ConversionData,
  AttributionData,
  TouchpointData,
  PatternDefinition,
  PatternCondition,
  DashboardWidget,
  AnalyticsReport,
  AnalyticsExport,
  EventTrackingConfig,
  AnalyticsSettings,
  AnalyticsError,
  ValidationRule,
  AnalyticsValidation,
  AggregationRule,
  MetricDefinition,
  AnalyticsAlert,
  AlertCondition,
  NotificationChannel
} from '../types/analytics.types';

export class AnalyticsService {
  private eventBuffer: SessionEvent[] = [];
  private bufferSize = 1000;
  private flushInterval = 60000; // 1 minute

  constructor(
    private db: Pool,
    private redis: Redis
  ) {
    this.startEventBuffering();
  }

  async trackEvent(event: Omit<SessionEvent, 'id'>): Promise<void> {
    const fullEvent: SessionEvent = {
      ...event,
      id: crypto.randomUUID()
    };

    // Ajout au buffer
    this.eventBuffer.push(fullEvent);

    // Flush si buffer plein
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushEventBuffer();
    }

    // Mise à jour des compteurs en temps réel
    await this.updateRealTimeMetrics(fullEvent);
  }

  async getUserAnalytics(
    userId: string,
    period: { start: Date; end: Date }
  ): Promise<UserAnalytics> {
    const result = await this.db.query(`
      WITH user_sessions AS (
        SELECT 
          s.*,
          COUNT(e.id) as event_count
        FROM sessions s
        LEFT JOIN session_events e ON s.id = e.session_id
        WHERE s.user_id = $1 
          AND s.start_time BETWEEN $2 AND $3
        GROUP BY s.id
      ),
      user_conversations AS (
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_conversations,
          SUM(message_count) as total_messages,
          SUM(token_usage) as total_tokens,
          SUM(cost) as total_cost,
          ARRAY_AGG(DISTINCT provider) as providers_used,
          ARRAY_AGG(DISTINCT model) as models_used
        FROM conversations
        WHERE user_id = $1 
          AND created_at BETWEEN $2 AND $3
      ),
      user_engagement AS (
        SELECT 
          COUNT(*) as shares_created,
          COUNT(*) as exports_generated,
          COUNT(*) as customizations_made
        FROM user_activities
        WHERE user_id = $1 
          AND created_at BETWEEN $2 AND $3
      )
      SELECT 
        (SELECT COUNT(*) FROM user_sessions) as total_sessions,
        (SELECT SUM(duration) FROM user_sessions) as total_duration,
        (SELECT AVG(duration) FROM user_sessions) as average_session_duration,
        (SELECT MAX(start_time) FROM user_sessions) as last_active_at,
        (SELECT COUNT(DISTINCT DATE(start_time)) FROM user_sessions) as days_active,
        (SELECT * FROM user_conversations),
        (SELECT * FROM user_engagement)
    `, [userId, period.start, period.end]);

    const data = result.rows[0];

    return {
      userId,
      period,
      activity: {
        totalSessions: data.total_sessions || 0,
        totalDuration: data.total_duration || 0,
        averageSessionDuration: data.average_session_duration || 0,
        lastActiveAt: data.last_active_at || new Date(),
        daysActive: data.days_active || 0,
        retentionRate: this.calculateRetentionRate(userId, period)
      },
      usage: {
        messagesSent: data.total_messages || 0,
        messagesReceived: data.total_messages || 0,
        conversationsCreated: data.total_conversations || 0,
        tokensUsed: data.total_tokens || 0,
        costIncurred: data.total_cost || 0,
        providersUsed: data.providers_used || [],
        modelsUsed: data.models_used || []
      },
      behavior: {
        peakHours: await this.getPeakHours(userId, period),
        preferredProvider: this.getPreferredProvider(data.providers_used || []),
        preferredModel: this.getPreferredModel(data.models_used || []),
        averageResponseTime: await this.getAverageResponseTime(userId, period),
        errorRate: await this.getErrorRate(userId, period),
        featureUsage: await this.getFeatureUsage(userId, period)
      },
      engagement: {
        sharesCreated: data.shares_created || 0,
        exportsGenerated: data.exports_generated || 0,
        customizationsMade: data.customizations_made || 0,
        feedbackGiven: await this.getFeedbackCount(userId, period),
        supportTickets: await this.getSupportTickets(userId, period)
      }
    };
  }

  async getUsageMetrics(
    period: { start: Date; end: Date },
    filters?: AnalyticsFilter
  ): Promise<UsageMetrics> {
    let whereClause = 'WHERE created_at BETWEEN $1 AND $2';
    const params: any[] = [period.start, period.end];
    let paramIndex = 3;

    if (filters) {
      if (filters.provider) {
        whereClause += ` AND provider = $${paramIndex}`;
        params.push(filters.provider);
        paramIndex++;
      }
      if (filters.model) {
        whereClause += ` AND model = $${paramIndex}`;
        params.push(filters.model);
        paramIndex++;
      }
      if (filters.country) {
        whereClause += ` AND country = $${paramIndex}`;
        params.push(filters.country);
        paramIndex++;
      }
      if (filters.device) {
        whereClause += ` AND device_type = $${paramIndex}`;
        params.push(filters.device);
        paramIndex++;
      }
    }

    const result = await this.db.query(`
      WITH daily_metrics AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as daily_active_users,
          COUNT(DISTINCT CASE WHEN created_at = MIN(created_at) OVER (PARTITION BY user_id) THEN user_id END) as new_users,
          COUNT(*) as sessions,
          AVG(duration) as avg_session_duration,
          COUNT(CASE WHEN duration < 30000 THEN 1 END)::float / COUNT(*) as bounce_rate
        FROM sessions
        ${whereClause}
        GROUP BY DATE(created_at)
      ),
      conversation_metrics AS (
        SELECT 
          COUNT(*) as total_conversations,
          AVG(message_count) as avg_messages,
          AVG(token_usage) as avg_tokens,
          AVG(cost) as avg_cost,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) as completion_rate
        FROM conversations
        ${whereClause}
      )
      SELECT 
        (SELECT SUM(daily_active_users) FROM daily_metrics) as total_active_users,
        (SELECT AVG(daily_active_users) FROM daily_metrics) as avg_active_users,
        (SELECT SUM(new_users) FROM daily_metrics) as total_new_users,
        (SELECT AVG(avg_session_duration) FROM daily_metrics) as avg_session_duration,
        (SELECT AVG(bounce_rate) FROM daily_metrics) as avg_bounce_rate,
        (SELECT * FROM conversation_metrics)
    `, params);

    const data = result.rows[0];

    return {
      period,
      users: {
        total: await this.getTotalUsers(period),
        active: data.total_active_users || 0,
        new: data.total_new_users || 0,
        returning: (data.total_active_users || 0) - (data.total_new_users || 0),
        churned: await this.getChurnedUsers(period),
        retained: await this.getRetainedUsers(period)
      },
      sessions: {
        total: await this.getTotalSessions(period),
        averageDuration: data.avg_session_duration || 0,
        bounceRate: data.avg_bounce_rate || 0,
        pagesPerSession: await this.getPagesPerSession(period)
      },
      conversations: {
        total: data.total_conversations || 0,
        averageMessages: data.avg_messages || 0,
        averageTokens: data.avg_tokens || 0,
        averageCost: data.avg_cost || 0,
        completionRate: data.completion_rate || 0
      },
      performance: {
        averageResponseTime: await this.getAverageResponseTime(null, period),
        errorRate: await this.getErrorRate(null, period),
        uptime: await this.getUptime(period),
        pageLoadTime: await this.getPageLoadTime(period)
      },
      revenue: {
        total: await this.getTotalRevenue(period),
        averagePerUser: await this.getAverageRevenuePerUser(period),
        averagePerSession: await this.getAverageRevenuePerSession(period),
        growth: await this.getRevenueGrowth(period)
      }
    };
  }

  async detectBehaviorPatterns(
    period: { start: Date; end: Date }
  ): Promise<BehaviorPattern[]> {
    const patterns: BehaviorPattern[] = [];

    // Pattern 1: Users at risk of churn
    const churnRisk = await this.detectChurnRisk(period);
    if (churnRisk.confidence > 0.7) {
      patterns.push(churnRisk);
    }

    // Pattern 2: Power users
    const powerUsers = await this.detectPowerUsers(period);
    if (powerUsers.confidence > 0.8) {
      patterns.push(powerUsers);
    }

    // Pattern 3: Conversion opportunities
    const conversionOpportunities = await this.detectConversionOpportunities(period);
    if (conversionOpportunities.confidence > 0.6) {
      patterns.push(conversionOpportunities);
    }

    // Pattern 4: Feature adoption gaps
    const featureGaps = await this.detectFeatureGaps(period);
    if (featureGaps.confidence > 0.5) {
      patterns.push(featureGaps);
    }

    return patterns;
  }

  async generateInsights(
    period: { start: Date; end: Date },
    userId?: string
  ): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    if (userId) {
      // User-specific insights
      const userAnalytics = await this.getUserAnalytics(userId, period);
      
      if (userAnalytics.activity.retentionRate < 0.5) {
        insights.push({
          type: 'retention_warning',
          title: 'Faible taux de rétention',
          description: 'L\'utilisateur a un taux de rétention inférieur à 50%',
          severity: 'medium',
          recommendations: [
            'Envoyer des emails de réengagement',
            'Suggérer des fonctionnalités non utilisées',
            'Offrir un support personnalisé'
          ],
          metrics: {
            retentionRate: userAnalytics.activity.retentionRate
          }
        });
      }

      if (userAnalytics.usage.costIncurred > 100) {
        insights.push({
          type: 'cost_optimization',
          title: 'Opportunité d\'optimisation des coûts',
          description: 'L\'utilisateur dépense plus de 100€ cette période',
          severity: 'low',
          recommendations: [
            'Suggérer des modèles plus économiques',
            'Optimiser les prompts',
            'Configurer des limites d\'utilisation'
          ],
          metrics: {
            totalCost: userAnalytics.usage.costIncurred
          }
        });
      }
    } else {
      // Global insights
      const usageMetrics = await this.getUsageMetrics(period);
      
      if (usageMetrics.performance.errorRate > 0.05) {
        insights.push({
          type: 'performance_alert',
          title: 'Taux d\'erreurs élevé',
          description: 'Le taux d\'erreurs dépasse 5%',
          severity: 'high',
          recommendations: [
            'Investiguer les erreurs récentes',
            'Vérifier l\'infrastructure',
            'Notifier l\'équipe technique'
          ],
          metrics: {
            errorRate: usageMetrics.performance.errorRate
          }
        });
      }
    }

    return insights;
  }

  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const activeUsers = await this.redis.get('realtime:active_users') || '0';
    const activeSessions = await this.redis.get('realtime:active_sessions') || '0';
    const eventsPerSecond = await this.redis.get('realtime:events_per_second') || '0';
    const averageResponseTime = await this.redis.get('realtime:avg_response_time') || '0';
    const errorRate = await this.redis.get('realtime:error_rate') || '0';
    const throughput = await this.redis.get('realtime:throughput') || '0';

    return {
      timestamp: new Date(),
      activeUsers: parseInt(activeUsers),
      activeSessions: parseInt(activeSessions),
      eventsPerSecond: parseFloat(eventsPerSecond),
      averageResponseTime: parseFloat(averageResponseTime),
      errorRate: parseFloat(errorRate),
      throughput: parseFloat(throughput)
    };
  }

  async createDashboard(widgets: DashboardWidget[]): Promise<string> {
    const dashboardId = crypto.randomUUID();
    await this.redis.setex(`dashboard:${dashboardId}`, 3600, JSON.stringify(widgets));
    return dashboardId;
  }

  async getDashboard(dashboardId: string): Promise<DashboardWidget[]> {
    const dashboard = await this.redis.get(`dashboard:${dashboardId}`);
    return dashboard ? JSON.parse(dashboard) : [];
  }

  async exportData(query: AnalyticsQuery, format: string): Promise<AnalyticsExport> {
    const exportId = crypto.randomUUID();
    const exportRecord: AnalyticsExport = {
      id: exportId,
      format: format as any,
      query,
      status: 'pending',
      createdAt: new Date()
    };

    await this.redis.setex(`export:${exportId}`, 3600, JSON.stringify(exportRecord));
    
    // Process export asynchronously
    this.processExport(exportId, query, format).catch(console.error);

    return exportRecord;
  }

  async getExportStatus(exportId: string): Promise<AnalyticsExport | null> {
    const exportData = await this.redis.get(`export:${exportId}`);
    return exportData ? JSON.parse(exportData) : null;
  }

  private startEventBuffering(): void {
    setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushEventBuffer().catch(console.error);
      }
    }, this.flushInterval);
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.db.query(`
        INSERT INTO session_events (
          id, session_id, timestamp, type, category, action, label, value,
          properties, page_context, user_context
        ) VALUES ${events.map((_, i) => 
          `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`
        ).join(', ')}
      `, events.flatMap(event => [
        event.id,
        event.sessionId,
        event.timestamp,
        event.type.name,
        event.category.id,
        event.action,
        event.label,
        event.value,
        JSON.stringify(event.properties),
        JSON.stringify(event.page),
        JSON.stringify(event.userContext)
      ]));

    } catch (error) {
      console.error('Error flushing event buffer:', error);
      // Remise des events dans le buffer en cas d'erreur
      this.eventBuffer.unshift(...events);
    }
  }

  private async updateRealTimeMetrics(event: SessionEvent): Promise<void> {
    const key = `realtime:${event.type.name}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 3600); // 1 heure

    // Mise à jour des métriques par utilisateur
    if (event.userContext.userId) {
      const userKey = `user_metrics:${event.userContext.userId}`;
      await this.redis.hincrby(userKey, 'events', 1);
      await this.redis.expire(userKey, 86400); // 24 heures
    }
  }

  private async processExport(exportId: string, query: AnalyticsQuery, format: string): Promise<void> {
    try {
      // Update status to processing
      const exportRecord = await this.redis.get(`export:${exportId}`);
      if (exportRecord) {
        const exportData = JSON.parse(exportRecord);
        exportData.status = 'processing';
        await this.redis.setex(`export:${exportId}`, 3600, JSON.stringify(exportData));
      }

      // Generate export data based on query
      const data = await this.executeQuery(query);
      
      // Convert to requested format
      let exportUrl: string;
      switch (format) {
        case 'csv':
          exportUrl = await this.generateCSV(data);
          break;
        case 'json':
          exportUrl = await this.generateJSON(data);
          break;
        case 'xlsx':
          exportUrl = await this.generateXLSX(data);
          break;
        case 'pdf':
          exportUrl = await this.generatePDF(data);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Update status to completed
      if (exportRecord) {
        const exportData = JSON.parse(exportRecord);
        exportData.status = 'completed';
        exportData.url = exportUrl;
        exportData.completedAt = new Date();
        await this.redis.setex(`export:${exportId}`, 3600, JSON.stringify(exportData));
      }

    } catch (error) {
      console.error('Export processing error:', error);
      // Update status to failed
      const exportRecord = await this.redis.get(`export:${exportId}`);
      if (exportRecord) {
        const exportData = JSON.parse(exportRecord);
        exportData.status = 'failed';
        exportData.error = error instanceof Error ? error.message : 'Unknown error';
        await this.redis.setex(`export:${exportId}`, 3600, JSON.stringify(exportData));
      }
    }
  }

  private async executeQuery(query: AnalyticsQuery): Promise<any[]> {
    // Implementation for executing analytics queries
    // This would involve building SQL queries based on the AnalyticsQuery
    return [];
  }

  private async generateCSV(data: any[]): Promise<string> {
    // CSV generation implementation
    return '/exports/data.csv';
  }

  private async generateJSON(data: any[]): Promise<string> {
    // JSON generation implementation
    return '/exports/data.json';
  }

  private async generateXLSX(data: any[]): Promise<string> {
    // XLSX generation implementation
    return '/exports/data.xlsx';
  }

  private async generatePDF(data: any[]): Promise<string> {
    // PDF generation implementation
    return '/exports/data.pdf';
  }

  // Méthodes utilitaires pour les calculs
  private calculateRetentionRate(userId: string, period: { start: Date; end: Date }): number {
    // Implémentation du calcul de rétention
    return 0.75; // Placeholder
  }

  private async getPeakHours(userId: string, period: { start: Date; end: Date }): Promise<number[]> {
    // Implémentation pour trouver les heures de pointe
    return [9, 10, 14, 15, 16]; // Placeholder
  }

  private getPreferredProvider(providers: string[]): string {
    // Retourne le provider le plus utilisé
    return providers[0] || 'openai';
  }

  private getPreferredModel(models: string[]): string {
    // Retourne le modèle le plus utilisé
    return models[0] || 'gpt-3.5-turbo';
  }

  private async getAverageResponseTime(userId: string | null, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul du temps de réponse moyen
    return 1500; // Placeholder
  }

  private async getErrorRate(userId: string | null, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul du taux d'erreur
    return 0.02; // Placeholder
  }

  private async getFeatureUsage(userId: string, period: { start: Date; end: Date }): Promise<Record<string, number>> {
    // Implémentation de l'analyse d'utilisation des fonctionnalités
    return {
      'chat': 45,
      'export': 3,
      'share': 2,
      'settings': 8
    };
  }

  private async getFeedbackCount(userId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du comptage des feedbacks
    return 2;
  }

  private async getSupportTickets(userId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du comptage des tickets de support
    return 0;
  }

  private async getTotalUsers(period: { start: Date; end: Date }): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE created_at BETWEEN $1 AND $2',
      [period.start, period.end]
    );
    return parseInt(result.rows[0].count);
  }

  private async getTotalSessions(period: { start: Date; end: Date }): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM sessions WHERE created_at BETWEEN $1 AND $2',
      [period.start, period.end]
    );
    return parseInt(result.rows[0].count);
  }

  private async getChurnedUsers(period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul des utilisateurs ayant quitté
    return 15;
  }

  private async getRetainedUsers(period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul des utilisateurs retenus
    return 85;
  }

  private async getPagesPerSession(period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul des pages par session
    return 3.5;
  }

  private async getUptime(period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul de l'uptime
    return 99.9;
  }

  private async getPageLoadTime(period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul du temps de chargement
    return 1200;
  }

  private async getTotalRevenue(period: { start: Date; end: Date }): Promise<number> {
    const result = await this.db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE created_at BETWEEN $1 AND $2',
      [period.start, period.end]
    );
    if (!result?.rows?.length) {
      return 0;
    }

    return parseFloat(result.rows[0].total);
  }

  private async getAverageRevenuePerUser(period: { start: Date; end: Date }): Promise<number> {
    const totalRevenue = await this.getTotalRevenue(period);
    const totalUsers = await this.getTotalUsers(period);
    return totalUsers > 0 ? totalRevenue / totalUsers : 0;
  }

  private async getAverageRevenuePerSession(period: { start: Date; end: Date }): Promise<number> {
    const totalRevenue = await this.getTotalRevenue(period);
    const totalSessions = await this.getTotalSessions(period);
    return totalSessions > 0 ? totalRevenue / totalSessions : 0;
  }

  private async getRevenueGrowth(period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul de croissance
    return 15.5;
  }

  private async detectChurnRisk(period: { start: Date; end: Date }): Promise<BehaviorPattern> {
    return {
      id: 'churn-risk',
      name: 'Risque de churn',
      description: 'Utilisateurs à risque de désabonnement',
      type: 'churn',
      pattern: {
        conditions: [
          { field: 'last_activity_days', operator: 'gt', value: 7 },
          { field: 'session_frequency', operator: 'lt', value: 1 }
        ],
        timeWindow: 30,
        minOccurrences: 1,
        aggregation: 'unique'
      },
      confidence: 0.75,
      frequency: 25,
      impact: 'high',
      recommendations: [
        'Lancer une campagne de réengagement',
        'Offrir des incitations à rester',
        'Contacter les utilisateurs à risque'
      ],
      createdAt: new Date()
    };
  }

  private async detectPowerUsers(period: { start: Date; end: Date }): Promise<BehaviorPattern> {
    return {
      id: 'power-users',
      name: 'Power users',
      description: 'Utilisateurs très actifs',
      type: 'engagement',
      pattern: {
        conditions: [
          { field: 'messages_per_day', operator: 'gt', value: 20 },
          { field: 'session_duration', operator: 'gt', value: 3600 }
        ],
        timeWindow: 7,
        minOccurrences: 5,
        aggregation: 'count'
      },
      confidence: 0.85,
      frequency: 10,
      impact: 'medium',
      recommendations: [
        'Créer un programme VIP',
        'Demander des feedbacks détaillés',
        'Offrir un accès prioritaire'
      ],
      createdAt: new Date()
    };
  }

  private async detectConversionOpportunities(period: { start: Date; end: Date }): Promise<BehaviorPattern> {
    return {
      id: 'conversion-ops',
      name: 'Opportunités de conversion',
      description: 'Utilisateurs prêts à convertir',
      type: 'conversion',
      pattern: {
        conditions: [
          { field: 'usage_frequency', operator: 'gte', value: 10 },
          { field: 'feature_adoption', operator: 'gte', value: 0.7 }
        ],
        timeWindow: 14,
        minOccurrences: 3,
        aggregation: 'unique'
      },
      confidence: 0.65,
      frequency: 15,
      impact: 'high',
      recommendations: [
        'Envoyer des offres ciblées',
        'Proposer une démo personnalisée',
        'Simplifier le processus de conversion'
      ],
      createdAt: new Date()
    };
  }

  private async detectFeatureGaps(period: { start: Date; end: Date }): Promise<BehaviorPattern> {
    return {
      id: 'feature-gaps',
      name: 'Gaps d\'adoption de fonctionnalités',
      description: 'Fonctionnalités sous-utilisées',
      type: 'usage',
      pattern: {
        conditions: [
          { field: 'feature_usage_rate', operator: 'lt', value: 0.1 }
        ],
        timeWindow: 30,
        minOccurrences: 1,
        aggregation: 'unique'
      },
      confidence: 0.55,
      frequency: 5,
      impact: 'medium',
      recommendations: [
        'Améliorer la découverte des fonctionnalités',
        'Créer des tutoriels',
        'Simplifier l\'interface'
      ],
      createdAt: new Date()
    };
  }
}
