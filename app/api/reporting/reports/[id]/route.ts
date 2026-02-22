import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getReportingServices } from '../../_shared';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { reportingService } = await getReportingServices();
    const reportId = (await params).id;

    const report = await reportingService.getReport(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    logger.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { reportingService } = await getReportingServices();
    const reportId = (await params).id;
    const body = await request.json();

    const report = await reportingService.getReport(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const updatedReport = {
      ...report,
      ...body,
      metadata: {
        ...report.metadata,
        updatedAt: new Date(),
        version: report.metadata.version + 1
      }
    };

    await reportingService.saveReport(updatedReport);

    return NextResponse.json({
      success: true,
      report: updatedReport
    });
  } catch (error) {
    logger.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await getReportingServices();
    const reportId = (await params).id;

    const result = await db.query(
      'DELETE FROM reports WHERE id = $1',
      [reportId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
