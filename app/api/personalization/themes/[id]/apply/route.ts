import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../../../_shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const personalizationService = await getPersonalizationService();
    const userId = request.headers.get('x-user-id');
    const themeId = (await params).id;

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
    logger.error('Error applying theme:', error);
    
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
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
