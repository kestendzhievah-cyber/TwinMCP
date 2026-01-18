import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { ReportingService } from '@/services/reporting.service';
import { ReportGenerator } from '@/services/report-generator.service';
import { InsightEngine } from '@/services/insight-engine.service';
import { DashboardRenderer } from '@/services/dashboard-renderer.service';
import { StreamingBillingService } from '@/services/streaming-billing.service';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const reportGenerator = new ReportGenerator();
const insightEngine = new InsightEngine();
const dashboardRenderer = new DashboardRenderer();
const billingService = new StreamingBillingService(db);

const reportingService = new ReportingService(
  db,
  redis,
  reportGenerator,
  insightEngine,
  dashboardRenderer,
  billingService
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;

    const report = await reportingService.getReport(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;
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
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;

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
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
