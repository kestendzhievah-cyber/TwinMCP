import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    // SECURITY: Use authenticated userId instead of trusting x-user-id header (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
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
    return handleApiError(error, 'ImportPreferences');
  }
}
