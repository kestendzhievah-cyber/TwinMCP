import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getReportingServices } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const { reportingService, db } = await getReportingServices();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    let reports;

    if (type || category || status) {
      const filters: any = {};
      if (type) filters.type = type;
      if (category) filters.category = category;
      if (status) filters.status = status;

      reports = await getReportsByFilters(db, filters);
    } else {
      reports = await getAllReports(db);
    }

    return NextResponse.json({
      reports,
      count: reports.length,
      filters: { type, category, status }
    });
  } catch (error) {
    logger.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
          format: { id: 'pdf', name: 'PDF', extension: '.pdf', mimeType: 'application/pdf', template: 'default' }, 
          branding: true 
        }
      },
      schedule: body.schedule,
      createdBy: body.createdBy || 'system',
      recipients: body.recipients || [],
      output: body.output || { 
        format: { id: 'pdf', name: 'PDF', extension: '.pdf', mimeType: 'application/pdf', template: 'default' }
      }
    });

    return NextResponse.json({
      success: true,
      report
    });
  } catch (error) {
    logger.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getAllReports(db: any) {
  const result = await db.query(`
    SELECT * FROM reports 
    ORDER BY created_at DESC
  `);

  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    type: JSON.parse(row.type),
    category: JSON.parse(row.category),
    frequency: JSON.parse(row.frequency),
    status: row.status,
    lastRun: row.last_run,
    nextRun: row.next_run,
    createdBy: row.created_by,
    createdAt: row.metadata?.createdAt || row.created_at,
    updatedAt: row.metadata?.updatedAt || row.updated_at
  }));
}

async function getReportsByFilters(db: any, filters: any) {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

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

  const result = await db.query(`
    SELECT * FROM reports 
    ${whereClause}
    ORDER BY created_at DESC
  `, params);

  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    type: JSON.parse(row.type),
    category: JSON.parse(row.category),
    frequency: JSON.parse(row.frequency),
    status: row.status,
    lastRun: row.last_run,
    nextRun: row.next_run,
    createdBy: row.created_by,
    createdAt: row.metadata?.createdAt || row.created_at,
    updatedAt: row.metadata?.updatedAt || row.updated_at
  }));
}
