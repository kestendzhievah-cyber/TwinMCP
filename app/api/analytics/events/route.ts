// src/app/api/analytics/events/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsServices } from '../_shared';
import {
  SessionEvent,
  EventType,
  EventCategory,
  PageContext,
  UserContext,
} from '@/src/types/analytics.types';
import { trackEventSchema, parseBody } from '@/lib/validations/api-schemas';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const { analyticsService } = await getAnalyticsServices();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(trackEventSchema, rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    const { sessionId, type, category, action, page, userContext } = parsed.data;

    // Build proper EventType object — the service accesses event.type.name
    const eventType: EventType =
      typeof type === 'string'
        ? {
            name: type,
            category: 'interaction' as const,
            schema: { required: [], optional: [], types: {} },
          }
        : (type as EventType);

    // Build proper EventCategory object — the service accesses event.category.id
    const eventCategory: EventCategory =
      typeof category === 'string'
        ? { id: category, name: category, description: '', metrics: [] }
        : (category as EventCategory);

    // Construct event object
    const event: Omit<SessionEvent, 'id'> = {
      sessionId,
      timestamp: new Date(parsed.data.timestamp || Date.now()),
      type: eventType,
      category: eventCategory,
      action,
      label: parsed.data.label,
      value: parsed.data.value,
      properties: parsed.data.properties || {},
      page: page as unknown as PageContext,
      userContext: userContext as unknown as UserContext,
    };

    // Track the event
    await analyticsService.trackEvent(event);

    return NextResponse.json({ success: true, message: 'Event tracked successfully' });
  } catch (error) {
    return handleApiError(error, 'TrackEvent');
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request.headers.get('authorization'));
    if (!authUserId) {
      throw new AuthenticationError();
    }

    const { db } = await getAnalyticsServices();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    // Scope to authenticated user — prevent IDOR
    const userId = authUserId;
    const eventType = searchParams.get('eventType');
    const rawLimit = parseInt(searchParams.get('limit') || '100');
    const rawOffset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 100 : rawLimit, 1), 500);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

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
        total,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GetEvents');
  }
}
