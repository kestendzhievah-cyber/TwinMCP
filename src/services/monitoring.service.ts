import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { 
  PerformanceMetrics,
  Alert,
  HealthCheck,
  SLO,
  SLAReport,
  MonitoringConfig
} from '../types/monitoring.types';
import { MetricsCollector } from './metrics-collector.service';
import { AlertManager } from './alert-manager.service';
import { HealthChecker } from './health-checker.service';

export class MonitoringService extends EventEmitter {
  private metricsHistory: PerformanceMetrics[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private sloMonitors: Map<string, SLO> = new Map();
  private isRunning: boolean = false;
  private intervals: NodeJS.Timeout[] = [];

  constructor(
    private db: Pool,
    private redis: Redis,
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager,
    private healthChecker: HealthChecker,
    private config: MonitoringConfig
  ) {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.alertManager.on('alert_created', (alert: Alert) => {
      this.activeAlerts.set(alert.id, alert);
      this.emit('alert', alert);
    });

    this.alertManager.on('alert_resolved', (alert: Alert) => {
      this.activeAlerts.delete(alert.id);
      this.emit('alert_resolved', alert);
    });

    this.alertManager.on('alert_acknowledged', (alert: Alert) => {
      this.emit('alert_acknowledged', alert);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Monitoring service is already running');
      return;
    }

    console.log('Starting monitoring service...');
    this.isRunning = true;

    // Load existing data
    await this.loadActiveAlerts();
    await this.loadSLOs();

    // Start monitoring intervals
    this.startMetricsCollection();
    this.startHealthChecks();
    this.startSLOEvaluation();
    this.startCleanup();

    this.emit('started');
    console.log('Monitoring service started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Monitoring service is not running');
      return;
    }

    console.log('Stopping monitoring service...');
    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    this.emit('stopped');
    console.log('Monitoring service stopped');
  }

  private startMetricsCollection(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const metrics = await this.collectMetrics();
        this.emit('metrics_collected', metrics);
      } catch (error) {
        console.error('Error collecting metrics:', error);
        this.emit('error', { type: 'metrics_collection', error });
      }
    }, this.config.collection.interval * 1000);

    this.intervals.push(interval);
  }

  private startHealthChecks(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const healthChecks = await this.performHealthChecks();
        this.emit('health_checks_completed', healthChecks);
      } catch (error) {
        console.error('Error performing health checks:', error);
        this.emit('error', { type: 'health_checks', error });
      }
    }, 60000); // Every minute

    this.intervals.push(interval);
  }

  private startSLOEvaluation(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.evaluateSLOs();
      } catch (error) {
        console.error('Error evaluating SLOs:', error);
        this.emit('error', { type: 'slo_evaluation', error });
      }
    }, 300000); // Every 5 minutes

    this.intervals.push(interval);
  }

  private startCleanup(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.cleanupOldMetrics();
      } catch (error) {
        console.error('Error cleaning up old metrics:', error);
      }
    }, 3600000); // Every hour

    this.intervals.push(interval);
  }

  async collectMetrics(): Promise<PerformanceMetrics> {
    try {
      const timestamp = new Date();
      
      // Collect metrics in parallel
      const [
        systemMetrics,
        applicationMetrics,
        databaseMetrics,
        networkMetrics,
        businessMetrics
      ] = await Promise.all([
        this.metricsCollector.getSystemMetrics(),
        this.metricsCollector.getApplicationMetrics(),
        this.metricsCollector.getDatabaseMetrics(),
        this.metricsCollector.getNetworkMetrics(),
        this.metricsCollector.getBusinessMetrics()
      ]);

      const metrics: PerformanceMetrics = {
        timestamp,
        system: systemMetrics,
        application: applicationMetrics,
        database: databaseMetrics,
        network: networkMetrics,
        business: businessMetrics
      };

      // Add to history
      this.metricsHistory.push(metrics);
      
      // Limit history to retention period
      const retentionMs = this.config.collection.retention * 24 * 60 * 60 * 1000;
      const cutoffTime = new Date(Date.now() - retentionMs);
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);

      // Save to database
      await this.saveMetrics(metrics);

      // Check for alerts
      await this.checkAlerts(metrics);

      // Cache latest metrics
      await this.cacheLatestMetrics(metrics);

      return metrics;

    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw error;
    }
  }

  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    if (this.metricsHistory.length === 0) {
      return await this.collectMetrics();
    }
    
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  async getMetricsHistory(
    period: { start: Date; end: Date },
    interval: '1m' | '5m' | '15m' | '1h' | '6h' | '1d' = '5m'
  ): Promise<PerformanceMetrics[]> {
    const result = await this.db.query(`
      SELECT * FROM performance_metrics
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp
    `, [period.start, period.end]);

    return result.rows.map(row => this.mapRowToMetrics(row));
  }

  async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'status'>): Promise<Alert> {
    // Create an alert rule first, then trigger evaluation
    const rule = {
      id: crypto.randomUUID(),
      name: alert.name,
      description: alert.description,
      metric: alert.metric,
      threshold: alert.threshold,
      severity: alert.severity,
      source: alert.source,
      tags: alert.tags,
      enabled: true,
      cooldown: 300
    };
    
    const currentMetrics = await this.getCurrentMetrics();
    const triggeredAlerts = await this.alertManager.evaluateRules(currentMetrics);
    
    // Find or create the specific alert
    let targetAlert = triggeredAlerts.find(a => a.name === alert.name);
    if (!targetAlert) {
      // Manually create the alert if rule evaluation didn't trigger it
      targetAlert = {
        ...alert,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        status: 'active',
        annotations: []
      };
    }
    
    return targetAlert;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    return await this.alertManager.acknowledgeAlert(alertId, userId);
  }

  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    return await this.alertManager.resolveAlert(alertId, userId);
  }

  async getActiveAlerts(filters?: {
    severity?: Alert['severity'];
    service?: string;
    tags?: string[];
  }): Promise<Alert[]> {
    return await this.alertManager.getActiveAlerts(filters);
  }

  async performHealthChecks(): Promise<HealthCheck[]> {
    const services = [
      'api-gateway',
      'auth-service',
      'chat-service',
      'llm-service',
      'database',
      'redis',
      'vector-search'
    ];

    const healthChecks = await Promise.all(
      services.map(service => this.healthChecker.checkService(service))
    );

    // Save health checks
    await this.saveHealthChecks(healthChecks);

    // Check for critical issues
    const unhealthyServices = healthChecks.filter(hc => hc.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      await this.createAlert({
        name: 'Service Unhealthy',
        description: `${unhealthyServices.length} service(s) unhealthy: ${unhealthyServices.map(s => s.service).join(', ')}`,
        severity: 'critical',
        source: 'health-check',
        metric: 'service.status',
        threshold: { operator: 'eq', value: 0, duration: 0 },
        currentValue: unhealthyServices.length,
        tags: ['health', 'service'],
        annotations: []
      });
    }

    return healthChecks;
  }

  async createSLO(slo: Omit<SLO, 'id' | 'current'>): Promise<SLO> {
    const fullSLO: SLO = {
      ...slo,
      id: crypto.randomUUID(),
      current: {
        availability: 0,
        errorBudget: 100,
        burnRate: 0
      }
    };

    await this.saveSLO(fullSLO);
    this.sloMonitors.set(fullSLO.id, fullSLO);

    return fullSLO;
  }

  async evaluateSLOs(): Promise<void> {
    for (const [sloId, slo] of this.sloMonitors) {
      try {
        const current = await this.calculateSLOCurrent(slo);
        slo.current = current;

        // Check SLO alerts
        if (slo.alerting.errorBudgetAlerts && current.errorBudget < 10) {
          await this.createAlert({
            name: `SLO Error Budget Low - ${slo.name}`,
            description: `Error budget for ${slo.name} is ${current.errorBudget.toFixed(2)}%`,
            severity: 'warning',
            source: 'slo',
            metric: 'error_budget',
            threshold: { operator: 'lt', value: 10, duration: 0 },
            currentValue: current.errorBudget,
            tags: ['slo', 'error-budget'],
            annotations: []
          });
        }

        if (slo.alerting.burnRateAlerts && current.burnRate > 2) {
          await this.createAlert({
            name: `SLO Burn Rate High - ${slo.name}`,
            description: `Burn rate for ${slo.name} is ${current.burnRate.toFixed(2)}`,
            severity: 'error',
            source: 'slo',
            metric: 'burn_rate',
            threshold: { operator: 'gt', value: 2, duration: 0 },
            currentValue: current.burnRate,
            tags: ['slo', 'burn-rate'],
            annotations: []
          });
        }

        await this.updateSLO(slo);

      } catch (error) {
        console.error(`Error evaluating SLO ${sloId}:`, error);
      }
    }
  }

  async generateSLAReport(period: { start: Date; end: Date }): Promise<SLAReport> {
    const services = await this.getSLAServices(period);
    
    const summary = {
      overallAvailability: this.calculateOverallAvailability(services),
      totalDowntime: this.calculateTotalDowntime(services),
      incidents: services.reduce((sum, s) => sum + s.incidents.length, 0),
      mttr: this.calculateMTTR(services)
    };

    return {
      period,
      services,
      summary
    };
  }

  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    try {
      const triggeredAlerts = await this.alertManager.evaluateRules(metrics);
      
      for (const alert of triggeredAlerts) {
        this.activeAlerts.set(alert.id, alert);
        this.emit('alert', alert);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  private async calculateSLOCurrent(slo: SLO): Promise<SLO['current']> {
    try {
      // Calculate availability based on the SLO indicator
      const availability = await this.calculateAvailability(slo.service, slo.indicator, slo.window);
      const errorBudget = Math.max(0, 100 - (100 - availability));
      const burnRate = await this.calculateBurnRate(slo.service, slo.indicator);

      return {
        availability,
        errorBudget,
        burnRate
      };
    } catch (error) {
      console.error(`Error calculating SLO current for ${slo.name}:`, error);
      return {
        availability: 0,
        errorBudget: 100,
        burnRate: 0
      };
    }
  }

  private async calculateAvailability(service: string, indicator: string, window: string): Promise<number> {
    // Parse window (e.g., "30d" -> 30 days)
    const windowMatch = window.match(/(\d+)([hdwmy])/);
    if (!windowMatch) return 100;

    const value = parseInt(windowMatch[1]);
    const unit = windowMatch[2];
    
    let days = 0;
    switch (unit) {
      case 'h': days = value / 24; break;
      case 'd': days = value; break;
      case 'w': days = value * 7; break;
      case 'm': days = value * 30; break;
      case 'y': days = value * 365; break;
    }

    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Calculate availability based on health checks or metrics
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks
      FROM health_checks
      WHERE service = $1 AND timestamp >= $2
    `, [service, startTime]);

    const row = result.rows[0];
    if (row.total_checks === 0) return 100;

    return (row.healthy_checks / row.total_checks) * 100;
  }

  private async calculateBurnRate(service: string, indicator: string): Promise<number> {
    // Simplified burn rate calculation
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await this.db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'unhealthy') as unhealthy_count
      FROM health_checks
      WHERE service = $1 AND timestamp >= $2
    `, [service, lastHour]);

    const unhealthyCount = parseInt(result.rows[0].unhealthy_count);
    return unhealthyCount > 0 ? unhealthyCount * 0.1 : 0; // Simplified calculation
  }

  private calculateOverallAvailability(services: any[]): number {
    if (services.length === 0) return 100;
    
    const totalAvailability = services.reduce((sum, s) => sum + s.availability, 0);
    return totalAvailability / services.length;
  }

  private calculateTotalDowntime(services: any[]): number {
    return services.reduce((sum, s) => sum + s.downtime, 0);
  }

  private calculateMTTR(services: any[]): number {
    const incidents = services.flatMap(s => s.incidents);
    if (incidents.length === 0) return 0;
    
    const totalDuration = incidents.reduce((sum, i) => sum + i.duration, 0);
    return totalDuration / incidents.length;
  }

  private async getSLAServices(period: { start: Date; end: Date }): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  private async loadActiveAlerts(): Promise<void> {
    try {
      const alerts = await this.alertManager.getActiveAlerts();
      for (const alert of alerts) {
        this.activeAlerts.set(alert.id, alert);
      }
    } catch (error) {
      console.error('Error loading active alerts:', error);
    }
  }

  private async loadSLOs(): Promise<void> {
    try {
      const result = await this.db.query('SELECT * FROM slos');
      for (const row of result.rows) {
        const slo: SLO = {
          id: row.id,
          name: row.name,
          description: row.description,
          service: row.service,
          indicator: row.indicator,
          target: row.target,
          window: row.window,
          alerting: JSON.parse(row.alerting),
          current: JSON.parse(row.current)
        };
        this.sloMonitors.set(slo.id, slo);
      }
    } catch (error) {
      console.error('Error loading SLOs:', error);
    }
  }

  private async saveMetrics(metrics: PerformanceMetrics): Promise<void> {
    await this.db.query(`
      INSERT INTO performance_metrics (
        timestamp, system, application, database, network, business
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
    `, [
      metrics.timestamp,
      JSON.stringify(metrics.system),
      JSON.stringify(metrics.application),
      JSON.stringify(metrics.database),
      JSON.stringify(metrics.network),
      JSON.stringify(metrics.business)
    ]);
  }

  private async cacheLatestMetrics(metrics: PerformanceMetrics): Promise<void> {
    await this.redis.setex(
      'monitoring:latest_metrics',
      300, // 5 minutes TTL
      JSON.stringify(metrics)
    );
  }

  private async saveHealthChecks(healthChecks: HealthCheck[]): Promise<void> {
    if (healthChecks.length === 0) return;

    await this.db.query(`
      INSERT INTO health_checks (
        service, status, timestamp, response_time, details
      ) VALUES ${healthChecks.map((_, i) => 
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      ).join(', ')}
    `, healthChecks.flatMap(hc => [
      hc.service,
      hc.status,
      hc.timestamp,
      hc.responseTime,
      JSON.stringify(hc.details)
    ]));
  }

  private async saveSLO(slo: SLO): Promise<void> {
    await this.db.query(`
      INSERT INTO slos (
        id, name, description, service, indicator, target, window,
        alerting, current
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        target = EXCLUDED.target,
        alerting = EXCLUDED.alerting,
        current = EXCLUDED.current
    `, [
      slo.id,
      slo.name,
      slo.description,
      slo.service,
      slo.indicator,
      slo.target,
      slo.window,
      JSON.stringify(slo.alerting),
      JSON.stringify(slo.current)
    ]);
  }

  private async updateSLO(slo: SLO): Promise<void> {
    await this.db.query(`
      UPDATE slos 
      SET current = $1
      WHERE id = $2
    `, [JSON.stringify(slo.current), slo.id]);
  }

  private async cleanupOldMetrics(): Promise<void> {
    const retentionDays = this.config.collection.retention;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    await this.db.query(
      'DELETE FROM performance_metrics WHERE timestamp < $1',
      [cutoffDate]
    );
  }

  private mapRowToMetrics(row: any): PerformanceMetrics {
    return {
      timestamp: row.timestamp,
      system: JSON.parse(row.system),
      application: JSON.parse(row.application),
      database: JSON.parse(row.database),
      network: JSON.parse(row.network),
      business: JSON.parse(row.business)
    };
  }

  // Public API methods
  getStatus(): { isRunning: boolean; uptime: number; alertsCount: number } {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? process.uptime() : 0,
      alertsCount: this.activeAlerts.size
    };
  }

  async getSystemHealth(): Promise<{ status: string; services: HealthCheck[] }> {
    const healthChecks = await this.performHealthChecks();
    const hasUnhealthy = healthChecks.some(hc => hc.status === 'unhealthy');
    const hasDegraded = healthChecks.some(hc => hc.status === 'degraded');

    return {
      status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      services: healthChecks
    };
  }
}
