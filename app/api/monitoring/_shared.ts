import type { MonitoringService } from '@/src/services/monitoring.service';
import type { HealthChecker } from '@/src/services/health-checker.service';
import type { Pool } from 'pg';

// Shared lazy-init singleton for all monitoring routes.
// Prevents DB/Redis connections during next build.
let _services: { monitoringService: MonitoringService; healthChecker: HealthChecker; db: Pool } | null = null;

export async function getMonitoringServices() {
  if (!_services) {
    const { redis } = await import('@/lib/redis');
    const { pool: db } = await import('@/lib/prisma');
    const { MonitoringService } = await import('@/src/services/monitoring.service');
    const { MetricsCollector } = await import('@/src/services/metrics-collector.service');
    const { AlertManager } = await import('@/src/services/alert-manager.service');
    const { HealthChecker } = await import('@/src/services/health-checker.service');

    const metricsCollector = new MetricsCollector(db, redis);
    const alertManager = new AlertManager(db, redis, { enabled: true, channels: [], escalation: [] });
    const healthChecker = new HealthChecker(db, redis);
    const monitoringConfig = {
      collection: { interval: 30, retention: 30, batchSize: 100 },
      alerts: { enabled: true, channels: [], escalation: [] },
      dashboards: { refreshInterval: 300, autoSave: true }
    };
    const monitoringService = new MonitoringService(db, redis, metricsCollector, alertManager, healthChecker, monitoringConfig);
    _services = { monitoringService, healthChecker, db };
  }
  return _services;
}

// Convenience alias
export async function getMonitoringService(): Promise<MonitoringService> {
  const { monitoringService } = await getMonitoringServices();
  return monitoringService;
}
