import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    const userId = request.headers.get('x-user-id') || 
                   request.nextUrl.searchParams.get('userId');

    const themes = await personalizationService.getAllThemes(userId || undefined);

    return NextResponse.json({
      success: true,
      data: themes,
      count: themes.length
    });

  } catch (error) {
    logger.error('Error getting themes:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get themes',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required for creating custom themes' },
        { status: 400 }
      );
    }

    const themeData = await request.json();

    // Validation des donnÃ©es requises
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
      message: 'Custom theme created successfully'
    });

  } catch (error) {
    logger.error('Error creating theme:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create theme',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
