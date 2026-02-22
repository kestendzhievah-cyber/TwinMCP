import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { monitoringService, db } = await getMonitoringServices();
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (service) {
      // Get SLOs for specific service
      const result = await db.query(
        'SELECT * FROM slos WHERE service = $1 ORDER BY created_at DESC',
        [service]
      );
      
      return NextResponse.json({
        service,
        slos: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          service: row.service,
          indicator: row.indicator,
          target: parseFloat(row.target),
          window: row.window,
          alerting: JSON.parse(row.alerting),
          current: JSON.parse(row.current),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
    } else {
      // Get all SLOs
      const result = await db.query('SELECT * FROM slos ORDER BY created_at DESC');
      
      return NextResponse.json({
        slos: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          service: row.service,
          indicator: row.indicator,
          target: parseFloat(row.target),
          window: row.window,
          alerting: JSON.parse(row.alerting),
          current: JSON.parse(row.current),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
    }
  } catch (error) {
    logger.error('Error fetching SLOs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { monitoringService } = await getMonitoringServices();
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.service || !body.indicator || !body.target || !body.window) {
      return NextResponse.json(
        { error: 'Missing required fields: name, service, indicator, target, window' },
        { status: 400 }
      );
    }

    const slo = await monitoringService.createSLO({
      name: body.name,
      description: body.description || '',
      service: body.service,
      indicator: body.indicator,
      target: parseFloat(body.target),
      window: body.window,
      alerting: body.alerting || {
        errorBudgetAlerts: true,
        burnRateAlerts: true
      }
    });

    return NextResponse.json({
      success: true,
      slo
    });
  } catch (error) {
    logger.error('Error creating SLO:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
