import { pool as db } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { PersonalizationService } from '@/src/services/personalization.service';

// Initialisation des services
const personalizationService = new PersonalizationService(db, redis);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const themeId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!themeId) {
      return NextResponse.json(
        { error: 'Theme ID is required' },
        { status: 400 }
      );
    }

    await personalizationService.applyTheme(userId, themeId);

    return NextResponse.json({
      success: true,
      message: 'Theme applied successfully'
    });

  } catch (error) {
    console.error('Error applying theme:', error);
    
    // Gestion des erreurs spécifiques
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to apply theme',
        message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
