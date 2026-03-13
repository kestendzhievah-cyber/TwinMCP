import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    // Use verified auth if available; themes list can include public themes for anonymous users
    const userId = await getAuthUserId(request.headers.get('authorization'));

    const themes = await personalizationService.getAllThemes(userId || undefined);

    return NextResponse.json({
      success: true,
      data: themes,
      count: themes.length,
    });
  } catch (error) {
    return handleApiError(error, 'ListThemes');
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require proper authentication for theme creation
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const personalizationService = await getPersonalizationService();

    const themeData = await request.json();

    // Validation des données requises
    if (!themeData.name || !themeData.colors || !themeData.typography) {
      return NextResponse.json(
        { error: 'Missing required theme data: name, colors, typography' },
        { status: 400 }
      );
    }

    const theme = await personalizationService.createCustomTheme(userId, themeData);

    return NextResponse.json({
      success: true,
      data: theme,
      message: 'Custom theme created successfully',
    });
  } catch (error) {
    return handleApiError(error, 'CreateTheme');
  }
}
