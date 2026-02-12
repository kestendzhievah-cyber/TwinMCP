import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { PersonalizationService } from '@/src/services/personalization.service';

// Initialisation des services
import { pool as db } from '@/lib/prisma'

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
        message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
