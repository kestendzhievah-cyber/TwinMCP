import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { monitoringService, db } = await getMonitoringServices();
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('start');
    const periodEnd = searchParams.get('end');

    if (periodStart && periodEnd) {
      // Generate SLA report for specific period
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO format: YYYY-MM-DDTHH:mm:ss.sssZ' },
          { status: 400 }
        );
      }

      const slaReport = await monitoringService.generateSLAReport({
        start: startDate,
        end: endDate
      });

      return NextResponse.json({
        period: slaReport.period,
        summary: slaReport.summary,
        services: slaReport.services
      });
    } else {
      // Get recent SLA reports
      const result = await db.query(
        'SELECT * FROM sla_reports ORDER BY period_start DESC LIMIT 10'
      );

      return NextResponse.json({
        reports: result.rows.map(row => ({
          id: row.id,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          overallAvailability: parseFloat(row.overall_availability),
          totalDowntime: parseInt(row.total_downtime),
          incidents: parseInt(row.incidents),
          mttr: row.mttr ? parseFloat(row.mttr) : null,
          createdAt: row.created_at
        }))
      });
    }
  } catch (error) {
    logger.error('Error fetching SLA reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { monitoringService, db } = await getMonitoringServices();
    const body = await request.json();
    
    // Validate required fields
    if (!body.start || !body.end) {
      return NextResponse.json(
        { error: 'Missing required fields: start, end' },
        { status: 400 }
      );
    }

    const startDate = new Date(body.start);
    const endDate = new Date(body.end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO format: YYYY-MM-DDTHH:mm:ss.sssZ' },
        { status: 400 }
      );
    }

    const slaReport = await monitoringService.generateSLAReport({
      start: startDate,
      end: endDate
    });

    // Save the report to database
    const insertResult = await db.query(`
      INSERT INTO sla_reports (
        period_start, period_end, overall_availability, total_downtime, incidents, mttr
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      slaReport.period.start,
      slaReport.period.end,
      slaReport.summary.overallAvailability,
      slaReport.summary.totalDowntime,
      slaReport.summary.incidents,
      slaReport.summary.mttr
    ]);

    const reportId = insertResult.rows[0].id;

    // Save services data
    for (const service of slaReport.services) {
      await db.query(`
        INSERT INTO sla_services (
          report_id, name, availability, uptime, downtime, sli
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        reportId,
        service.name,
        service.availability,
        service.uptime,
        service.downtime,
        JSON.stringify(service.sli)
      ]);
    }

    return NextResponse.json({
      success: true,
      reportId,
      period: slaReport.period,
      summary: slaReport.summary,
      services: slaReport.services
    });
  } catch (error) {
    logger.error('Error generating SLA report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
