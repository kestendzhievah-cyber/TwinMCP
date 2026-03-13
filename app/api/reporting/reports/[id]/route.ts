import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getReportingServices } from '../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { reportingService } = await getReportingServices();
    const reportId = (await params).id;

    const report = await reportingService.getReport(reportId);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    return handleApiError(error, 'GetReport');
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { reportingService } = await getReportingServices();
    const reportId = (await params).id;
    const body = await request.json();

    const report = await reportingService.getReport(reportId);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // SECURITY: Only allow updating known safe fields — prevent prototype pollution
    // and mass assignment (attacker overwriting id, metadata.version, etc.)
    const { title, description, query, format, schedule, filters, config } = body;
    const updatedReport = {
      ...report,
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(query !== undefined && { query }),
      ...(format !== undefined && { format }),
      ...(schedule !== undefined && { schedule }),
      ...(filters !== undefined && { filters }),
      ...(config !== undefined && { config }),
      metadata: {
        ...report.metadata,
        updatedAt: new Date(),
        version: report.metadata.version + 1,
      },
    };

    await reportingService.saveReport(updatedReport);

    return NextResponse.json({
      success: true,
      report: updatedReport,
    });
  } catch (error) {
    return handleApiError(error, 'UpdateReport');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { db } = await getReportingServices();
    const reportId = (await params).id;

    const result = await db.query('DELETE FROM reports WHERE id = $1', [reportId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    return handleApiError(error, 'DeleteReport');
  }
}
