// @ts-nocheck
import { SearchAnalyticsService } from '../src/services/search-analytics.service';
import { Pool } from 'pg';
import { SearchResult } from '../src/types/search.types';

// Mock dependencies
jest.mock('pg');

describe('SearchAnalyticsService', () => {
  let service: SearchAnalyticsService;
  let mockDb: jest.Mocked<Pool>;

  beforeEach(() => {
    mockDb = new Pool() as jest.Mocked<Pool>;
    service = new SearchAnalyticsService(mockDb);
  });

  describe('logSearch', () => {
    it('should log search with results', async () => {
      const query = 'react';
      const userId = 'user-123';
      const results: SearchResult[] = [
        {
          library: {
            id: '1',
            name: 'react',
            displayName: 'React',
            description: 'A JavaScript library',
            language: 'JavaScript'
          },
          score: 0.9,
          matchType: 'exact',
          matchDetails: {},
          explanation: 'Exact match',
          clicked: true
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await service.logSearch({ query, userId, resultCount: results.length });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO search_logs'),
        [query, userId, 1, undefined]
      );
    });

    it('should log search without results', async () => {
      const query = 'nonexistent';

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await service.logSearch({ query, resultCount: 0 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO search_logs'),
        [query, undefined, 0, undefined]
      );
    });
  });

  describe('logClick', () => {
    it('should log click and update relevance score', async () => {
      const libraryId = 'lib-123';
      const query = 'react';
      const userId = 'user-123';

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // INSERT INTO search_clicks
        .mockResolvedValueOnce({ rows: [] }); // UPDATE search_relevance

      await service.logClick(libraryId, query, userId);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO search_clicks'),
        [libraryId, query, userId]
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO search_relevance'),
        [libraryId, query]
      );
    });
  });

  describe('getPopularQueries', () => {
    it('should return popular queries for last 7 days', async () => {
      const mockQueries = [
        { query: 'react', count: 100 },
        { query: 'vue', count: 80 },
        { query: 'angular', count: 60 }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockQueries });

      const result = await service.getPopularQueries(10);

      expect(result).toEqual(mockQueries);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_at > NOW() - INTERVAL \'7 days\''),
        [10]
      );
    });

    it('should use default limit of 10', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await service.getPopularQueries();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [10]
      );
    });
  });

  describe('getZeroResultQueries', () => {
    it('should return queries with zero results', async () => {
      const mockQueries = [
        { query: 'nonexistent1', count: 5 },
        { query: 'nonexistent2', count: 3 }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockQueries });

      const result = await service.getZeroResultQueries();

      expect(result).toEqual(mockQueries);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE result_count = 0')
      );
    });
  });

  describe('getSearchAnalytics', () => {
    it('should return analytics for week timeframe', async () => {
      const mockData = [
        { count: '1000' }, // total searches
        { count: '500' },  // unique queries
        { avg: '25.5' },   // average results
        [],                 // top queries
        []                  // zero result queries
      ];

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockData[0]] })
        .mockResolvedValueOnce({ rows: [mockData[1]] })
        .mockResolvedValueOnce({ rows: [mockData[2]] })
        .mockResolvedValueOnce({ rows: mockData[3] })
        .mockResolvedValueOnce({ rows: mockData[4] });

      const result = await service.getSearchAnalytics('week');

      expect(result.totalSearches).toBe(1000);
      expect(result.uniqueQueries).toBe(500);
      expect(result.averageResults).toBe(25.5);
      expect(result.topQueries).toEqual([]);
      expect(result.zeroResultQueries).toEqual([]);
    });

    it('should handle different timeframes', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [{ count: '0', avg: '0' }] });

      await service.getSearchAnalytics('day');
      await service.getSearchAnalytics('month');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('1 day')
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('30 days')
      );
    });
  });

  describe('getLibraryClickStats', () => {
    it('should return click statistics for library', async () => {
      const libraryId = 'lib-123';
      const mockData = [
        { count: '50' },  // total clicks
        { count: '10' },  // unique queries
        [],                // top queries
        { count: '200' }  // total searches
      ];

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockData[0]] })
        .mockResolvedValueOnce({ rows: [mockData[1]] })
        .mockResolvedValueOnce({ rows: mockData[2] })
        .mockResolvedValueOnce({ rows: [mockData[3]] });

      const result = await service.getLibraryClickStats(libraryId, 'week');

      expect(result.totalClicks).toBe(50);
      expect(result.uniqueQueries).toBe(10);
      expect(result.clickRate).toBe(0.25); // 50/200
      expect(result.topQueries).toEqual([]);
    });

    it('should handle zero searches', async () => {
      const libraryId = 'lib-123';
      const mockData = [
        { count: '0' },
        { count: '0' },
        [],
        { count: '0' }
      ];

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockData[0]] })
        .mockResolvedValueOnce({ rows: [mockData[1]] })
        .mockResolvedValueOnce({ rows: [mockData[2]] })
        .mockResolvedValueOnce({ rows: [mockData[3]] });

      const result = await service.getLibraryClickStats(libraryId);

      expect(result.clickRate).toBe(0);
    });
  });

  describe('getUserSearchHistory', () => {
    it('should return user search history', async () => {
      const userId = 'user-123';
      const mockHistory = [
        {
          query: 'react',
          result_count: 10,
          clicked_result: 'lib-123',
          created_at: new Date()
        },
        {
          query: 'vue',
          result_count: 8,
          clicked_result: null,
          created_at: new Date()
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockHistory });

      const result = await service.getUserSearchHistory(userId, 50);

      expect(result).toEqual(mockHistory);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [userId, 50]
      );
    });

    it('should use default limit of 50', async () => {
      const userId = 'user-123';
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await service.getUserSearchHistory(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [userId, 50]
      );
    });
  });

  describe('getRelevanceScores', () => {
    it('should return relevance scores for query', async () => {
      const query = 'react';
      const mockScores = [
        {
          library_id: 'lib-123',
          library_name: 'react',
          score: 0.95,
          last_updated: new Date()
        },
        {
          library_id: 'lib-456',
          library_name: 'react-dom',
          score: 0.85,
          last_updated: new Date()
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockScores });

      const result = await service.getRelevanceScores(query);

      expect(result).toEqual(mockScores);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE sr.query = $1'),
        [query]
      );
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old logs', async () => {
      const daysToKeep = 90;

      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await service.cleanupOldLogs(daysToKeep);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('DELETE FROM search_logs')
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('DELETE FROM search_clicks')
      );
    });

    it('should use default of 90 days', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      await service.cleanupOldLogs();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('90 days')
      );
    });
  });
});
