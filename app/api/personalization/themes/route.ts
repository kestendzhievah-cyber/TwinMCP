import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import { PersonalizationService } from '@/src/services/personalization.service';

// Initialisation des services
import { pool as db } from '@/lib/prisma'

const personalizationService = new PersonalizationService(db, redis);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 
                   request.nextUrl.searchParams.get('userId');

    const themes = await personalizationService.getAllThemes(userId || undefined);

    return NextResponse.json({
      success: true,
      data: themes,
      count: themes.length
    });

  } catch (error) {
    console.error('Error getting themes:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get themes',
        message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required for creating custom themes' },
        { status: 400 }
      );
    }

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
      message: 'Custom theme created successfully'
    });

  } catch (error) {
    console.error('Error creating theme:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create theme',
        message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
