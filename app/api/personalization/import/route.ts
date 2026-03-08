import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function POST(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    // SECURITY: Use authenticated userId instead of trusting x-user-id header (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, options } = await request.json();

    if (!data) {
      return NextResponse.json({ error: 'Import data is required' }, { status: 400 });
    }

    // Validation que data est une chaîne JSON
    if (typeof data !== 'string') {
      return NextResponse.json({ error: 'Import data must be a JSON string' }, { status: 400 });
    }

    const updatedPreferences = await personalizationService.importPreferences(userId, data);

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferences imported successfully',
    });
  } catch (error) {
    logger.error('Error importing preferences:', error);

    // Gestion des erreurs spécifiques
    if (error instanceof Error) {
      if (error.message.includes('version')) {
        return NextResponse.json({ error: 'Unsupported preferences version' }, { status: 400 });
      }
      if (error.message.includes('Invalid preferences data')) {
        return NextResponse.json(
          { error: 'Invalid preferences format' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to import preferences',
      },
      { status: 500 }
    );
  }
}
