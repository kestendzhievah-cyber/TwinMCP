import { logger } from '../../utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { EnhancedSearchController } from '../../controllers/enhanced-search.controller';
import { SearchMatchingService } from '../../services/search-matching.service';
import { SearchAnalyticsService } from '../../services/search-analytics.service';
import { Pool } from 'pg';

// Initialize services
const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
const searchMatchingService = new SearchMatchingService(db);
const analyticsService = new SearchAnalyticsService(db);
const searchController = new EnhancedSearchController(searchMatchingService, analyticsService);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'search':
        return await searchController.search(request);
      
      case 'suggestions':
        return await searchController.suggestions(request);
      
      case 'analytics':
        return await searchController.analytics(request);
      
      case 'popular':
        return await searchController.popularQueries(request);
      
      case 'zero-results':
        return await searchController.zeroResultQueries(request);
      
      case 'relevance':
        return await searchController.relevanceScores(request);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'click':
        return await searchController.click(request);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
