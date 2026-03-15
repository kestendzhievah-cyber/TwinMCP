import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getReportingServices } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { reportingService, db } = await getReportingServices();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    let reports;

    if (type || category || status) {
      const filters: any = {};
      if (type) filters.type = type;
      if (category) filters.category = category;
      if (status) filters.status = status;

      reports = await getReportsByFilters(db, userId, filters, limit, offset);
    } else {
      reports = await getAllReports(db, userId, limit, offset);
    }

    return NextResponse.json({
      reports,
      count: reports.length,
      filters: { type, category, status },
    });
  } catch (error) {
    return handleApiError(error, 'ListReports');
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { reportingService } = await getReportingServices();
    const body = await request.json();

    if (!body.name || !body.type || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, category' },
        { status: 400 }
      );
    }

    const report = await reportingService.createReport({
      name: body.name,
      description: body.description || '',
      type: body.type,
      category: body.category,
      frequency: body.frequency || { type: 'once', timezone: 'UTC' },
      status: 'draft',
      config: body.config || {
        period: { start: new Date(), end: new Date() },
        filters: [],
        metrics: [],
        dimensions: [],
        visualizations: [],
        insights: { enabled: true, types: [], threshold: 0.7 },
        output: {
          format: {
            id: 'pdf',
            name: 'PDF',
            extension: '.pdf',
            mimeType: 'application/pdf',
            template: 'default',
          },
          branding: true,
        },
      },
      schedule: body.schedule,
      createdBy: body.createdBy || 'system',
      recipients: body.recipients || [],
      output: body.output || {
        format: {
          id: 'pdf',
          name: 'PDF',
          extension: '.pdf',
          mimeType: 'application/pdf',
          template: 'default',
        },
      },
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    return handleApiError(error, 'CreateReport');
  }
}

async function getAllReports(db: any, userId: string, limit: number, offset: number) {
  const result = await db.query(`
    SELECT * FROM reports
    WHERE created_by = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    type: safeParse(row.type),
    category: safeParse(row.category),
    frequency: safeParse(row.frequency),
    status: row.status,
    lastRun: row.last_run,
    nextRun: row.next_run,
    createdBy: row.created_by,
    createdAt: row.metadata?.createdAt || row.created_at,
    updatedAt: row.metadata?.updatedAt || row.updated_at,
  }));
}

function safeParse(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

async function getReportsByFilters(db: any, userId: string, filters: any, limit: number, offset: number) {
  let whereClause = 'WHERE created_by = $1';
  const params: any[] = [userId];
  let paramIndex = 2;

  if (filters.type) {
    whereClause += ` AND type->>'id' = $${paramIndex}`;
    params.push(filters.type);
    paramIndex++;
  }

  if (filters.category) {
    whereClause += ` AND category->>'id' = $${paramIndex}`;
    params.push(filters.category);
    paramIndex++;
  }

  if (filters.status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  const result = await db.query(
    `
    SELECT * FROM reports 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `,
    [...params, limit, offset]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    type: safeParse(row.type),
    category: safeParse(row.category),
    frequency: safeParse(row.frequency),
    status: row.status,
    lastRun: row.last_run,
    nextRun: row.next_run,
    createdBy: row.created_by,
    createdAt: row.metadata?.createdAt || row.created_at,
    updatedAt: row.metadata?.updatedAt || row.updated_at,
  }));
}
