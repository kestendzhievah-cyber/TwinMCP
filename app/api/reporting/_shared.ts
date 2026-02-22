import type { Pool } from 'pg';

// Lazy-init singleton for reporting route services.
let _services: any = null;

export async function getReportingServices() {
  if (!_services) {
    const { redis } = await import('@/lib/redis');
    const { pool: db } = await import('@/lib/prisma');
    const { ReportingService } = await import('@/src/services/reporting.service');
    const { ReportGenerator } = await import('@/src/services/report-generator.service');
    const { InsightEngine } = await import('@/src/services/insight-engine.service');
    const { DashboardRenderer } = await import('@/src/services/dashboard-renderer.service');
    const { StreamingBillingService } = await import('@/src/services/streaming-billing.service');

    const reportGenerator = new ReportGenerator();
    const insightEngine = new InsightEngine();
    const dashboardRenderer = new DashboardRenderer();
    const billingService = new StreamingBillingService(db);

    const reportingService = new ReportingService(
      db, redis, reportGenerator, insightEngine, dashboardRenderer, billingService
    );

    _services = { reportingService, db };
  }
  return _services as { reportingService: any; db: Pool };
}
