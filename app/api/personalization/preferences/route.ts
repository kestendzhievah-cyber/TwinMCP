import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    // RÃ©cupÃ©ration de l'userId depuis les headers ou le query param
    const userId = request.headers.get('x-user-id') || 
                   request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const preferences = await personalizationService.getUserPreferences(userId);

    return NextResponse.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    logger.error('Error getting user preferences:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get preferences',
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
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updates = await request.json();

    // Validation basique
    if (typeof updates !== 'object' || updates === null) {
      return NextResponse.json(
        { error: 'Invalid updates data' },
        { status: 400 }
      );
    }

    const updatedPreferences = await personalizationService.updateUserPreferences(
      userId,
      updates
    );

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferences updated successfully'
    });

  } catch (error) {
    logger.error('Error updating user preferences:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const personalizationService = await getPersonalizationService();
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const preferences = await request.json();

    // Validation complÃ¨te
    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Invalid preferences data' },
        { status: 400 }
      );
    }

    const updatedPreferences = await personalizationService.updateUserPreferences(
      userId,
      preferences
    );

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferences replaced successfully'
    });

  } catch (error) {
    logger.error('Error replacing user preferences:', error);
    return NextResponse.json(
      { 
        error: 'Failed to replace preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
