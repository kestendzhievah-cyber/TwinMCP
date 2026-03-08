import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

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
    logger.error('Error getting themes:', error);
    return NextResponse.json(
      {
        error: 'Failed to get themes',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require proper authentication for theme creation
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required for creating custom themes' },
        { status: 401 }
      );
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
    logger.error('Error creating theme:', error);
    return NextResponse.json(
      {
        error: 'Failed to create theme',
      },
      { status: 500 }
    );
  }
}
