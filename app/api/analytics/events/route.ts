// src/app/api/analytics/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/src/services/analytics.service';
import { SessionEvent, EventType, EventCategory, PageContext, UserContext } from '@/src/types/analytics.types';

import { pool } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const db = pool;

const analyticsService = new AnalyticsService(db, redis);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { sessionId, type, category, action, page, userContext } = body;
    
    if (!sessionId || !type || !category || !action || !page || !userContext) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, type, category, action, page, userContext' },
        { status: 400 }
      );
    }

    // Construct event object
    const event: Omit<SessionEvent, 'id'> = {
      sessionId,
      timestamp: new Date(body.timestamp || Date.now()),
      type: type as EventType,
      category: category as EventCategory,
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
    console.error('Error tracking event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT 
        id,
        session_id,
        timestamp,
        event_type,
        event_category,
        action,
        label,
        value,
        properties,
        page_url,
        page_title,
        user_id,
        created_at
      FROM session_events
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (sessionId) {
      query += ` AND session_id = $${paramIndex}`;
      params.push(sessionId);
      paramIndex++;
    }

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return NextResponse.json({
      events: result.rows,
      pagination: {
        limit,
        offset,
        total: result.rowCount
      }
    });
    
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
