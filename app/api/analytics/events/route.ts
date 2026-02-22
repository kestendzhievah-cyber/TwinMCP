// src/app/api/analytics/events/route.ts
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import { SessionEvent, EventType, EventCategory, PageContext, UserContext } from '@/src/types/analytics.types';

export async function POST(request: NextRequest) {
  try {
    const { analyticsService } = await getAnalyticsServices();
    const body = await request.json();
    
    // Validate required fields
    const { sessionId, type, category, action, page, userContext } = body;
    
    if (!sessionId || !type || !category || !action || !page || !userContext) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, type, category, action, page, userContext' },
        { status: 400 }
      );
    }

    // Build proper EventType object — the service accesses event.type.name
    const eventType: EventType = typeof type === 'string'
      ? { name: type, category: 'interaction', schema: { required: [], optional: [], types: {} } }
      : type;

    // Build proper EventCategory object — the service accesses event.category.id
    const eventCategory: EventCategory = typeof category === 'string'
      ? { id: category, name: category, description: '', metrics: [] }
      : category;

    // Construct event object
    const event: Omit<SessionEvent, 'id'> = {
      sessionId,
      timestamp: new Date(body.timestamp || Date.now()),
      type: eventType,
      category: eventCategory,
      action,
      label: body.label,
      value: body.value,
      properties: body.properties || {},
      page: page as PageContext,
      userContext: userContext as UserContext,
    };

    // Track the event
    await analyticsService.trackEvent(event);

    return NextResponse.json({ success: true, message: 'Event tracked successfully' });
    
  } catch (error) {
    logger.error('Error tracking event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await getAnalyticsServices();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build WHERE clause with parameterized filters
    let whereClause = 'WHERE 1=1';
    const filterParams: any[] = [];
    let paramIndex = 1;

    if (sessionId) {
      whereClause += ` AND session_id = $${paramIndex}`;
      filterParams.push(sessionId);
      paramIndex++;
    }

    if (userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      filterParams.push(userId);
      paramIndex++;
    }

    if (eventType) {
      whereClause += ` AND event_type = $${paramIndex}`;
      filterParams.push(eventType);
      paramIndex++;
    }

    // Count total matching rows (before LIMIT/OFFSET)
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM session_events ${whereClause}`,
      filterParams
    );
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Fetch paginated results
    const dataQuery = `
      SELECT 
        id, session_id, timestamp, event_type, event_category,
        action, label, value, properties, page_url, page_title,
        user_id, created_at
      FROM session_events
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await db.query(dataQuery, [...filterParams, limit, offset]);

    return NextResponse.json({
      events: result.rows,
      pagination: {
        limit,
        offset,
        total
      }
    });
    
  } catch (error) {
    logger.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
