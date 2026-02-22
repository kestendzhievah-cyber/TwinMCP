import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { monitoringService, healthChecker } = await getMonitoringServices();
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (service) {
      // Get health check for specific service
      const healthCheck = await healthChecker.checkService(service);
      return NextResponse.json({
        service: healthCheck.service,
        status: healthCheck.status,
        timestamp: healthCheck.timestamp,
        responseTime: healthCheck.responseTime,
        details: healthCheck.details,
        dependencies: healthCheck.dependencies
      });
    } else {
      // Get overall system health
      const systemHealth = await monitoringService.getSystemHealth();
      return NextResponse.json({
        status: systemHealth.status,
        services: systemHealth.services,
        summary: {
          total: systemHealth.services.length,
          healthy: systemHealth.services.filter(s => s.status === 'healthy').length,
          degraded: systemHealth.services.filter(s => s.status === 'degraded').length,
          unhealthy: systemHealth.services.filter(s => s.status === 'unhealthy').length
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching health status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { healthChecker } = await getMonitoringServices();
    const body = await request.json();
    
    if (!body.service) {
      return NextResponse.json(
        { error: 'Missing required field: service' },
        { status: 400 }
      );
    }

    // Trigger health check for specific service
    const healthCheck = await healthChecker.checkService(body.service);

    return NextResponse.json({
      success: true,
      healthCheck
    });
  } catch (error) {
    logger.error('Error performing health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
