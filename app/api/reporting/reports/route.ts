import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { ReportingService } from '@/src/services/reporting.service';
import { ReportGenerator } from '@/src/services/report-generator.service';
import { InsightEngine } from '@/src/services/insight-engine.service';
import { DashboardRenderer } from '@/src/services/dashboard-renderer.service';
import { StreamingBillingService } from '@/src/services/streaming-billing.service';

import { pool as db } from '@/lib/prisma'
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

export async function GET(request: NextRequest) {
  try {
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

      reports = await getReportsByFilters(filters);
    } else {
      reports = await getAllReports();
    }

    return NextResponse.json({
      reports,
      count: reports.length,
      filters: { type, category, status }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getAllReports() {
  const result = await db.query(`
    SELECT * FROM reports 
    ORDER BY created_at DESC
  `);

  return result.rows.map(row => ({
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

async function getReportsByFilters(filters: any) {
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

  return result.rows.map(row => ({
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
