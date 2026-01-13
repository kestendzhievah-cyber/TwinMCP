import { LibrarySearchController } from '../src/controllers/library-search.controller';
import { LibrarySearchService } from '../src/services/library-search.service';
import { LibraryAnalyticsService } from '../src/services/library-analytics.service';
import { CacheService } from '../src/services/cache.service';

// Mock dependencies
jest.mock('../src/services/library-search.service');
jest.mock('../src/services/library-analytics.service');
jest.mock('../src/services/cache.service');

describe('LibrarySearchController', () => {
  let controller: LibrarySearchController;
  let mockSearchService: jest.Mocked<LibrarySearchService>;
  let mockAnalyticsService: jest.Mocked<LibraryAnalyticsService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockSearchService = new LibrarySearchService({} as any, {} as any, {} as any) as jest.Mocked<LibrarySearchService>;
    mockAnalyticsService = new LibraryAnalyticsService({} as any) as jest.Mocked<LibraryAnalyticsService>;
    mockCacheService = new CacheService({} as any) as jest.Mocked<CacheService>;
    
    controller = new LibrarySearchController(
      mockSearchService,
      mockAnalyticsService,
      mockCacheService
    );
  });

  describe('search', () => {
    it('should return cached results when available', async () => {
      const mockCachedResults = {
        results: [{ name: 'react', displayName: 'React' }],
        total: 1,
        pagination: { page: 1, limit: 20, total: 1, pages: 1, hasNext: false, hasPrev: false }
      };

      const mockRequest = {
        query: { q: 'react', page: 1, limit: 20 },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockCacheService.get.mockResolvedValue(mockCachedResults);

      await controller.search(mockRequest, mockReply);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCachedResults,
        cached: true
      });
    });

    it('should perform search and cache results when not cached', async () => {
      const mockSearchResults = {
        results: [{ name: 'react', displayName: 'React' }],
        total: 1,
        pagination: { page: 1, limit: 20, total: 1, pages: 1, hasNext: false, hasPrev: false }
      };

      const mockRequest = {
        query: { q: 'react', page: 1, limit: 20 },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockCacheService.get.mockResolvedValue(null);
      mockSearchService.search.mockResolvedValue(mockSearchResults);
      mockAnalyticsService.logSearch.mockResolvedValue(undefined);

      await controller.search(mockRequest, mockReply);

      expect(mockSearchService.search).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockAnalyticsService.logSearch).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResults,
        searchTime: expect.any(Number),
        cached: false
      });
    });

    it('should handle search errors gracefully', async () => {
      const mockRequest = {
        query: { q: '' }, // Invalid query
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      await controller.search(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid search parameters'
      });
    });
  });

  describe('autocomplete', () => {
    it('should return empty array for short queries', async () => {
      const mockRequest = {
        query: { q: 'r', limit: 10 },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      await controller.autocomplete(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should return autocomplete suggestions', async () => {
      const mockSuggestions = [
        { name: 'react', type: 'exact' },
        { name: 'react-dom', type: 'partial' }
      ];

      const mockRequest = {
        query: { q: 'reac', limit: 10 },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockCacheService.get.mockResolvedValue(null);
      mockSearchService.autocomplete.mockResolvedValue(mockSuggestions);

      await controller.autocomplete(mockRequest, mockReply);

      expect(mockSearchService.autocomplete).toHaveBeenCalledWith('reac', 10);
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockSuggestions,
        cached: false
      });
    });
  });

  describe('getLibrary', () => {
    it('should return library details', async () => {
      const mockLibrary = {
        id: '1',
        name: 'react',
        displayName: 'React',
        description: 'A JavaScript library for building user interfaces'
      };

      const mockRequest = {
        params: { name: 'react' },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockCacheService.get.mockResolvedValue(null);
      mockSearchService.getLibraryDetails.mockResolvedValue(mockLibrary);

      await controller.getLibrary(mockRequest, mockReply);

      expect(mockSearchService.getLibraryDetails).toHaveBeenCalledWith('react');
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockLibrary,
        cached: false
      });
    });

    it('should return 404 when library not found', async () => {
      const mockRequest = {
        params: { name: 'nonexistent' },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockCacheService.get.mockResolvedValue(null);
      mockSearchService.getLibraryDetails.mockResolvedValue(null);

      await controller.getLibrary(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Library not found'
      });
    });
  });

  describe('getContextualSuggestions', () => {
    it('should return contextual suggestions', async () => {
      const mockSuggestions = {
        basedOnDependencies: [{ name: 'react-router' }],
        basedOnFramework: [{ name: 'react-dom' }],
        basedOnPreferences: [{ name: 'typescript' }],
        trending: [{ name: 'next.js' }]
      };

      const mockRequest = {
        body: {
          project: {
            dependencies: ['react'],
            framework: 'react'
          },
          user: {
            preferences: {
              languages: ['TypeScript']
            }
          }
        },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockSearchService.getContextualSuggestions.mockResolvedValue(mockSuggestions);

      await controller.getContextualSuggestions(mockRequest, mockReply);

      expect(mockSearchService.getContextualSuggestions).toHaveBeenCalledWith(mockRequest.body);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockSuggestions
      });
    });
  });

  describe('getSearchStats', () => {
    it('should return user search stats when authenticated', async () => {
      const mockStats = {
        totalSearches: 100,
        averageResults: 15.5,
        topQueries: [{ query: 'react', count: 10 }],
        recentActivity: [{ query: 'vue', resultCount: 8, createdAt: new Date() }]
      };

      const mockRequest = {
        user: { id: 'user-123' },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      mockAnalyticsService.getUserSearchStats.mockResolvedValue(mockStats);

      await controller.getSearchStats(mockRequest, mockReply);

      expect(mockAnalyticsService.getUserSearchStats).toHaveBeenCalledWith('user-123');
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });

    it('should return 401 when not authenticated', async () => {
      const mockRequest = {
        user: null,
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis()
      } as any;

      await controller.getSearchStats(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });
  });

  describe('exportResults', () => {
    it('should export results as JSON', async () => {
      const mockResults = {
        results: [{ name: 'react', displayName: 'React' }],
        total: 1
      };

      const mockRequest = {
        query: { q: 'react', format: 'json' },
        user: { id: 'user-123' },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis()
      } as any;

      mockSearchService.search.mockResolvedValue(mockResults);
      mockAnalyticsService.logExport.mockResolvedValue(undefined);

      await controller.exportResults(mockRequest, mockReply);

      expect(mockSearchService.search).toHaveBeenCalled();
      expect(mockAnalyticsService.logExport).toHaveBeenCalled();
      expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockReply.send).toHaveBeenCalledWith(expect.any(String));
    });

    it('should export results as CSV', async () => {
      const mockResults = {
        results: [{ name: 'react', displayName: 'React' }],
        total: 1
      };

      const mockRequest = {
        query: { q: 'react', format: 'csv' },
        user: { id: 'user-123' },
        log: { error: jest.fn() }
      } as any;

      const mockReply = {
        send: jest.fn().mockReturnThis(),
        code: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis()
      } as any;

      mockSearchService.search.mockResolvedValue(mockResults);
      mockAnalyticsService.logExport.mockResolvedValue(undefined);

      await controller.exportResults(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('name,displayName'));
    });
  });
});
