import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    // SECURITY: Use authenticated userId instead of trusting x-user-id header (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const exportData = await personalizationService.exportPreferences(userId);

    // Retourner le JSON avec les headers appropriés pour le téléchargement
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="personalization-preferences.json"`,
      },
    });
  } catch (error) {
    logger.error('Error exporting preferences:', error);
    return NextResponse.json(
      {
        error: 'Failed to export preferences',
      },
      { status: 500 }
    );
  }
}
