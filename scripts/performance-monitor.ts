import { PrometheusClient } from 'prometheus-client';
import { AlertManager } from './alert-manager';

export class PerformanceMonitor {
  private prometheus: PrometheusClient;
  private alertManager: AlertManager;

  constructor() {
    this.prometheus = new PrometheusClient();
    this.alertManager = new AlertManager();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // Métriques de performance
    this.responseTimeHistogram = new this.prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    this.requestRateGauge = new this.prometheus.Gauge({
      name: 'http_requests_per_second',
      help: 'HTTP requests per second',
      labelNames: ['method', 'route']
    });

    this.errorRateGauge = new this.prometheus.Gauge({
      name: 'http_error_rate',
      help: 'HTTP error rate',
      labelNames: ['method', 'route']
    });

    this.activeConnectionsGauge = new this.prometheus.Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    this.queueLengthGauge = new this.prometheus.Gauge({
      name: 'queue_length',
      help: 'Length of processing queue',
      labelNames: ['queue_name']
    });
  }

  async trackRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    this.responseTimeHistogram
      .labels(method, route, statusCode.toString())
      .observe(duration);

    // Mise à jour du taux d'erreurs
    if (statusCode >= 400) {
      this.errorRateGauge
        .labels(method, route)
        .inc();
    }

    // Vérification des seuils d'alerte
    await this.checkPerformanceThresholds(method, route, statusCode, duration);
  }

  private async checkPerformanceThresholds(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    // Alertes de latence
    if (duration > 5) {
      await this.alertManager.createAlert({
        name: 'High Latency Detected',
        description: `Request to ${route} took ${duration}s`,
        severity: 'warning',
        labels: { method, route, duration: duration.toString() }
      });
    }

    // Alertes de taux d'erreurs
    const errorRate = await this.calculateErrorRate(method, route);
    if (errorRate > 0.05) { // 5%
      await this.alertManager.createAlert({
        name: 'High Error Rate',
        description: `Error rate for ${route} is ${(errorRate * 100).toFixed(2)}%`,
        severity: 'critical',
        labels: { method, route, errorRate: errorRate.toString() }
      });
    }
  }

  private async calculateErrorRate(method: string, route: string): Promise<number> {
    const totalRequests = await this.prometheus.query(
      `sum(rate(http_requests_total{method="${method}",route="${route}"}[5m]))`
    );

    const errorRequests = await this.prometheus.query(
      `sum(rate(http_requests_total{method="${method}",route="${route}",status_code=~"4.."}[5m]))`
    );

    return parseFloat(errorRequests) / parseFloat(totalRequests) || 0;
  }

  async trackResourceUsage(): Promise<void> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = await this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();

    // Alertes de ressources
    if (cpuUsage > 80) {
      await this.alertManager.createAlert({
        name: 'High CPU Usage',
        description: `CPU usage is ${cpuUsage}%`,
        severity: 'warning'
      });
    }

    if (memoryUsage > 85) {
      await this.alertManager.createAlert({
        name: 'High Memory Usage',
        description: `Memory usage is ${memoryUsage}%`,
        severity: 'critical'
      });
    }

    if (diskUsage > 90) {
      await this.alertManager.createAlert({
        name: 'High Disk Usage',
        description: `Disk usage is ${diskUsage}%`,
        severity: 'critical'
      });
    }
  }

  private async getCPUUsage(): Promise<number> {
    const result = await this.prometheus.query(
      '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))'
    );
    return parseFloat(result) || 0;
  }

  private async getMemoryUsage(): Promise<number> {
    const result = await this.prometheus.query(
      '100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'
    );
    return parseFloat(result) || 0;
  }

  private async getDiskUsage(): Promise<number> {
    const result = await this.prometheus.query(
      '100 * (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))'
    );
    return parseFloat(result) || 0;
  }
}
