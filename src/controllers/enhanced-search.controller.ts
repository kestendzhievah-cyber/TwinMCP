import { NextRequest, NextResponse } from 'next/server';
import { SearchMatchingService } from '../services/search-matching.service';
import { SearchAnalyticsService } from '../services/search-analytics.service';
import { z } from 'zod';

const searchQuerySchema = z.object({
  query: z.string().min(1).max(100),
  context: z.object({
    userTags: z.array(z.string()).optional(),
    userPreferences: z.object({
      languages: z.array(z.string()).optional(),
      licenses: z.array(z.string()).optional(),
      quality: z.enum(['high', 'medium', 'any']).optional()
    }).optional(),
    projectContext: z.object({
      dependencies: z.array(z.string()).optional(),
      framework: z.string().optional()
    }).optional()
  }).optional(),
  filters: z.object({
    tags: z.array(z.string()).optional(),
    language: z.string().optional(),
    license: z.string().optional(),
    status: z.string().optional(),
    minQuality: z.number().min(0).max(1).optional(),
    minPopularity: z.number().min(0).max(1).optional()
  }).optional(),
  options: z.object({
    fuzzy: z.boolean().default(true),
    suggestions: z.boolean().default(true),
    includeDeprecated: z.boolean().default(false),
    boostRecent: z.boolean().default(false)
  }).optional()
});

export class EnhancedSearchController {
  constructor(
    private searchMatchingService: SearchMatchingService,
    private analyticsService: SearchAnalyticsService
  ) {}

  async search(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const queryParam = searchParams.get('q');
      
      if (!queryParam) {
        return NextResponse.json(
          { success: false, error: 'Query parameter "q" is required' },
          { status: 400 }
        );
      }

      const body = await request.json().catch(() => ({}));
      
      const query = searchQuerySchema.parse({
        query: queryParam,
        context: body.context,
        filters: body.filters,
        options: body.options
      });

      const results = await this.searchMatchingService.search(query);

      // Logging pour analytics
      await this.analyticsService.logSearch({
        query: query.query,
        resultCount: results.results?.length ?? 0
      });

      return NextResponse.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid search parameters' },
        { status: 400 }
      );
    }
  }

  async click(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const libraryId = searchParams.get('libraryId');
      
      if (!libraryId) {
        return NextResponse.json(
          { success: false, error: 'libraryId parameter is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { query } = body;

      if (!query) {
        return NextResponse.json(
          { success: false, error: 'query is required in request body' },
          { status: 400 }
        );
      }

      await this.analyticsService.logClick(
        libraryId,
        query,
        (request as any).user?.id
      );

      return NextResponse.json({
        success: true,
        message: 'Click logged'
      });
    } catch (error) {
      console.error('Click logging error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async suggestions(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');
      
      if (!query || query.length < 2) {
        return NextResponse.json({
          success: true,
          data: []
        });
      }

      const suggestions = await this.searchMatchingService.generateSuggestions(query);
      
      return NextResponse.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Suggestions error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async analytics(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' || 'week';
      
      const analytics = await this.analyticsService.getSearchAnalytics(timeframe);
      
      return NextResponse.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Analytics error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async popularQueries(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '10');
      
      const popularQueries = await this.analyticsService.getPopularQueries(limit);
      
      return NextResponse.json({
        success: true,
        data: popularQueries
      });
    } catch (error) {
      console.error('Popular queries error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async zeroResultQueries(request: NextRequest): Promise<NextResponse> {
    try {
      const zeroResultQueries = await this.analyticsService.getZeroResultQueries();
      
      return NextResponse.json({
        success: true,
        data: zeroResultQueries
      });
    } catch (error) {
      console.error('Zero result queries error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async libraryStats(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const libraryId = searchParams.get('libraryId');
      const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' || 'week';
      
      if (!libraryId) {
        return NextResponse.json(
          { success: false, error: 'libraryId parameter is required' },
          { status: 400 }
        );
      }

      const stats = await this.analyticsService.getLibraryClickStats(libraryId, timeframe);
      
      return NextResponse.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Library stats error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async userHistory(request: NextRequest): Promise<NextResponse> {
    try {
      const userId = (request as any).user?.id;
      
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '50');
      
      const history = await this.analyticsService.getUserSearchHistory(userId, limit);
      
      return NextResponse.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('User history error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  async relevanceScores(request: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');
      
      if (!query) {
        return NextResponse.json(
          { success: false, error: 'Query parameter "q" is required' },
          { status: 400 }
        );
      }

      const scores = await this.analyticsService.getRelevanceScores(query);
      
      return NextResponse.json({
        success: true,
        data: scores
      });
    } catch (error) {
      console.error('Relevance scores error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
