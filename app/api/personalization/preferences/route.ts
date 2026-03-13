import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPersonalizationService } from '../_shared';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Use verified auth — never trust x-user-id header (IDOR vector)
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const personalizationService = await getPersonalizationService();

    const preferences = await personalizationService.getUserPreferences(userId);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    return handleApiError(error, 'GetPreferences');
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const personalizationService = await getPersonalizationService();

    const updates = await request.json();

    // Validation basique
    if (typeof updates !== 'object' || updates === null) {
      return NextResponse.json({ error: 'Invalid updates data' }, { status: 400 });
    }

    const updatedPreferences = await personalizationService.updateUserPreferences(userId, updates);

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    return handleApiError(error, 'UpdatePreferences');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const personalizationService = await getPersonalizationService();

    const preferences = await request.json();

    // Validation complète
    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences data' }, { status: 400 });
    }

    const updatedPreferences = await personalizationService.updateUserPreferences(
      userId,
      preferences
    );

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferences replaced successfully',
    });
  } catch (error) {
    return handleApiError(error, 'ReplacePreferences');
  }
}
