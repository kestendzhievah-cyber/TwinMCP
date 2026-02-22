import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const exportData = await personalizationService.exportPreferences(userId);

    // Retourner le JSON avec les headers appropriÃ©s pour le tÃ©lÃ©chargement
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="personalization-preferences-${userId}.json"`
      }
    });

  } catch (error) {
    logger.error('Error exporting preferences:', error);
    return NextResponse.json(
      { 
        error: 'Failed to export preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
