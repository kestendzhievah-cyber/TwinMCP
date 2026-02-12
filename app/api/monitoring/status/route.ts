import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/src/services/monitoring.service';
import { MetricsCollector } from '@/src/services/metrics-collector.service';
import { AlertManager } from '@/src/services/alert-manager.service';
import { HealthChecker } from '@/src/services/health-checker.service';

// Initialize services
import { pool as db } from '@/lib/prisma'
const metricsCollector = new MetricsCollector(db, redis);
const alertManager = new AlertManager(db, redis, { enabled: true, channels: [], escalation: [] });
const healthChecker = new HealthChecker(db, redis);
const monitoringConfig = {
  collection: { interval: 30, retention: 30, batchSize: 100 },
  alerts: { enabled: true, channels: [], escalation: [] },
  dashboards: { refreshInterval: 300, autoSave: true }
};
const monitoringService = new MonitoringService(db, redis, metricsCollector, alertManager, healthChecker, monitoringConfig);

export async function GET(request: NextRequest) {
  try {
    // Get monitoring service status
    const serviceStatus = monitoringService.getStatus();
    
    // Get system health
    const systemHealth = await monitoringService.getSystemHealth();
    
    // Get current metrics
    const currentMetrics = await monitoringService.getCurrentMetrics();
    
    // Get active alerts count by severity
    const activeAlerts = await monitoringService.getActiveAlerts();
    const alertsBySeverity = activeAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get recent metrics summary
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMetrics = await monitoringService.getMetricsHistory(
      { start: oneHourAgo, end: new Date() },
      '5m'
    );

    // Calculate averages
    const avgCpuUsage = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.system.cpu.usage, 0) / recentMetrics.length 
      : 0;
    
    const avgMemoryUsage = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + (m.system.memory.used / m.system.memory.total * 100), 0) / recentMetrics.length 
      : 0;

    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.application.requests.averageLatency, 0) / recentMetrics.length 
      : 0;

    return NextResponse.json({
      timestamp: new Date(),
      service: serviceStatus,
      system: {
        status: systemHealth.status,
        services: systemHealth.services.length,
        healthy: systemHealth.services.filter(s => s.status === 'healthy').length,
        degraded: systemHealth.services.filter(s => s.status === 'degraded').length,
        unhealthy: systemHealth.services.filter(s => s.status === 'unhealthy').length
      },
      metrics: {
        current: {
          cpu: currentMetrics.system.cpu.usage,
          memory: (currentMetrics.system.memory.used / currentMetrics.system.memory.total * 100),
          responseTime: currentMetrics.application.requests.averageLatency,
          requests: currentMetrics.application.requests.total,
          errors: currentMetrics.application.errors.total
        },
        averages: {
          cpu: Math.round(avgCpuUsage * 100) / 100,
          memory: Math.round(avgMemoryUsage * 100) / 100,
          responseTime: Math.round(avgResponseTime * 100) / 100
        }
      },
      alerts: {
        total: activeAlerts.length,
        bySeverity: alertsBySeverity
      },
      uptime: serviceStatus.uptime
    });
  } catch (error) {
    console.error('Error fetching monitoring status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === 'start') {
      await monitoringService.start();
      return NextResponse.json({
        success: true,
        message: 'Monitoring service started'
      });
    } else if (body.action === 'stop') {
      await monitoringService.stop();
      return NextResponse.json({
        success: true,
        message: 'Monitoring service stopped'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error controlling monitoring service:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
