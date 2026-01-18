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

    const exportData = await personalizationService.exportPreferences(userId);

    // Retourner le JSON avec les headers appropriés pour le téléchargement
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="personalization-preferences-${userId}.json"`
      }
    });

  } catch (error) {
    console.error('Error exporting preferences:', error);
    return NextResponse.json(
      { 
        error: 'Failed to export preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
