import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { PersonalizationService } from '../../../../services/personalization.service';

// Initialisation des services
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const personalizationService = new PersonalizationService(db, redis);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const analytics = await personalizationService.getAnalytics(userId);

    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
