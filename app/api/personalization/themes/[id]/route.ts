import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const personalizationService = await getPersonalizationService();
    const themeId = (await params).id;

    if (!themeId) {
      return NextResponse.json({ error: 'Theme ID is required' }, { status: 400 });
    }

    const theme = await personalizationService.getTheme(themeId);

    if (!theme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: theme,
    });
  } catch (error) {
    logger.error('Error getting theme:', error);
    return NextResponse.json(
      {
        error: 'Failed to get theme',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const personalizationService = await getPersonalizationService();
    // SECURITY: Use authenticated userId instead of trusting x-user-id header (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const themeId = (await params).id;

    if (!themeId) {
      return NextResponse.json({ error: 'Theme ID is required' }, { status: 400 });
    }

    const updates = await request.json();

    const updatedTheme = await personalizationService.updateCustomTheme(userId, themeId, updates);

    return NextResponse.json({
      success: true,
      data: updatedTheme,
      message: 'Theme updated successfully',
    });
  } catch (error) {
    logger.error('Error updating theme:', error);

    // Gestion des erreurs spécifiques
    if (error instanceof Error) {
      if (error.message.includes('not found or access denied')) {
        return NextResponse.json({ error: 'Theme not found or access denied' }, { status: 404 });
      }
      if (error.message.includes('validation failed')) {
        return NextResponse.json(
          { error: 'Theme validation failed' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update theme',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const personalizationService = await getPersonalizationService();
    // SECURITY: Use authenticated userId instead of trusting x-user-id header (IDOR)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const themeId = (await params).id;

    if (!themeId) {
      return NextResponse.json({ error: 'Theme ID is required' }, { status: 400 });
    }

    await personalizationService.deleteCustomTheme(userId, themeId);

    return NextResponse.json({
      success: true,
      message: 'Theme deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting theme:', error);

    // Gestion des erreurs spécifiques
    if (error instanceof Error && error.message.includes('not found or access denied')) {
      return NextResponse.json({ error: 'Theme not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to delete theme',
      },
      { status: 500 }
    );
  }
}
