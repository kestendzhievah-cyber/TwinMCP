import type { Pool } from 'pg';

// Lazy-init singleton for analytics route services.
let _services: { analyticsService: any; db: Pool } | null = null;

export async function getAnalyticsServices() {
  if (!_services) {
    const { pool: db } = await import('@/lib/prisma');
    const { redis } = await import('@/lib/redis');
    const { AnalyticsService } = await import('@/src/services/analytics.service');
    _services = { analyticsService: new AnalyticsService(db, redis), db };
  }
  return _services;
}
