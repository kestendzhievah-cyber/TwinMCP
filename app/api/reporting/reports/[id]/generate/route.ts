import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getReportingServices } from '../../../_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { reportingService } = await getReportingServices();
    const reportId = (await params).id;
    const body = await request.json();

    const generation = await reportingService.generateReport(reportId, {
      format: body.format,
      filters: body.filters,
      email: body.email || false
    });

    return NextResponse.json({
      success: true,
      generation
    });
  } catch (error) {
    logger.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { reportingService, db } = await getReportingServices();
    const reportId = (await params).id;
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generation');

    if (generationId) {
      const generation = await reportingService.getGenerationStatus(generationId);
      if (!generation) {
        return NextResponse.json(
          { error: 'Generation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ generation });
    } else {
      const result = await db.query(
        'SELECT * FROM report_generations WHERE report_id = $1 ORDER BY started_at DESC',
        [reportId]
      );

      const generations = result.rows.map(row => ({
        id: row.id,
        reportId: row.report_id,
        status: row.status,
        progress: JSON.parse(row.progress),
        output: JSON.parse(row.output),
        error: row.error,
        startedAt: row.started_at,
        completedAt: row.completed_at
      }));

      return NextResponse.json({ generations });
    }
  } catch (error) {
    logger.error('Error fetching report generations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
