import { logger } from '../../../utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { EnhancedSearchController } from '../../../controllers/enhanced-search.controller';
import { SearchMatchingService } from '../../../services/search-matching.service';
import { SearchAnalyticsService } from '../../../services/search-analytics.service';
import { Pool } from 'pg';

// Initialize services
const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
const searchMatchingService = new SearchMatchingService(db);
const analyticsService = new SearchAnalyticsService(db);
const searchController = new EnhancedSearchController(searchMatchingService, analyticsService);

export async function GET(
  request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'stats':
        return await searchController.libraryStats(request);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Library search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
