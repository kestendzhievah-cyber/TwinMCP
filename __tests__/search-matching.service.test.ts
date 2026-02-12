import { SearchMatchingService } from '../src/services/search-matching.service';
import { Pool } from 'pg';
import { SearchResult, Library } from '../src/types/search.types';

// Mock dependencies
jest.mock('pg');

describe('SearchMatchingService', () => {
  let service: SearchMatchingService;
  let mockDb: jest.Mocked<Pool>;

  beforeEach(() => {
    mockDb = new Pool() as jest.Mocked<Pool>;
    service = new SearchMatchingService(mockDb);
  });

  describe('search', () => {
    it('should return exact matches first', async () => {
      const mockLibraries = [
        {
          id: '1',
          name: 'react',
          display_name: 'React',
          description: 'A JavaScript library for building user interfaces',
          total_downloads: 1000000,
          weekly_downloads: 50000,
          stars: 200000,
          forks: 40000,
          issues: 1000,
          language: 'JavaScript',
          status: 'active',
          quality_score: 0.9,
          popularity_score: 0.95,
          maintenance_score: 0.85,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockQuery = {
        query: 'react',
        options: { fuzzy: true, suggestions: true }
      };

      // Mock exact search results
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ 
          rows: mockLibraries.map(row => ({
            ...row,
            text_rank: 0.8,
            name_rank: 1.0,
            name_similarity: 0.9
          }))
        })
        .mockResolvedValueOnce({ rows: [] }) // fuzzy search
        .mockResolvedValueOnce({ rows: [] }); // semantic search

      const result = await service.search(mockQuery);

      expect(result.results).toHaveLength.greaterThan(0);
      expect(result.results[0].matchType).toBe('exact');
      expect(result.searchTime).toBeLessThan(500);
      expect(result.queryProcessed).toBe('react');
    });

    it('should handle fuzzy matching', async () => {
      const mockLibraries = [
        {
          id: '1',
          name: 'react',
          display_name: 'React',
          description: 'A JavaScript library for building user interfaces',
          total_downloads: 1000000,
          weekly_downloads: 50000,
          stars: 200000,
          forks: 40000,
          issues: 1000,
          language: 'JavaScript',
          status: 'active',
          quality_score: 0.9,
          popularity_score: 0.95,
          maintenance_score: 0.85,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockQuery = {
        query: 'reac', // Faute de frappe
        options: { fuzzy: true }
      };

      // Mock search results
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // exact search
        .mockResolvedValueOnce({ 
          rows: mockLibraries.map(row => ({
            ...row,
            name_similarity: 0.8,
            desc_similarity: 0.6,
            fuzzy_rank: 0.8
          }))
        })
        .mockResolvedValueOnce({ rows: [] }); // semantic search

      const result = await service.search(mockQuery);

      expect(result.results).toHaveLength.greaterThan(0);
      expect(result.results.some(r => r.matchType === 'fuzzy')).toBe(true);
    });

    it('should provide relevant suggestions', async () => {
      const mockQuery = {
        query: 'btn',
        options: { suggestions: true }
      };

      const mockSuggestions = ['button', 'button-group', 'button-component'];

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // exact search
        .mockResolvedValueOnce({ rows: [] }) // fuzzy search
        .mockResolvedValueOnce({ rows: [] }) // semantic search
        .mockResolvedValueOnce({ 
          rows: mockSuggestions.map(name => ({ name, similarity: 0.8 }))
        });

      const result = await service.search(mockQuery);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('button');
    });

    it('should apply personalized ranking', async () => {
      const mockLibraries = [
        {
          id: '1',
          name: 'axios',
          display_name: 'Axios',
          description: 'Promise based HTTP client',
          total_downloads: 20000000,
          weekly_downloads: 1000000,
          stars: 99000,
          forks: 10000,
          issues: 500,
          language: 'TypeScript',
          status: 'active',
          quality_score: 0.95,
          popularity_score: 0.98,
          maintenance_score: 0.9,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockQuery = {
        query: 'http',
        context: {
          userPreferences: {
            languages: ['TypeScript']
          }
        }
      };

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ 
          rows: mockLibraries.map(row => ({
            ...row,
            text_rank: 0.7,
            name_rank: 0.6,
            name_similarity: 0.5
          }))
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.search(mockQuery);

      const tsLibraries = result.results.filter(r => 
        r.library.language === 'TypeScript'
      );
      
      expect(tsLibraries.length).toBeGreaterThan(0);
      expect(result.results[0].score).toBeGreaterThan(0.5);
    });
  });

  describe('generateSuggestions', () => {
    it('should return suggestions for partial query', async () => {
      const query = 'rea';
      const mockSuggestions = [
        { name: 'react', similarity: 0.9 },
        { name: 'react-dom', similarity: 0.8 },
        { name: 'react-native', similarity: 0.7 }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockSuggestions });

      const suggestions = await service.generateSuggestions(query);

      expect(suggestions).toEqual(['react', 'react-dom', 'react-native']);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT name, similarity(name, $1) as similarity'),
        [query]
      );
    });

    it('should return empty array for very short query', async () => {
      const query = 'r';

      const suggestions = await service.generateSuggestions(query);

      expect(suggestions).toEqual([]);
    });
  });

  describe('preprocessQuery', () => {
    it('should normalize common abbreviations', () => {
      const service = new SearchMatchingService(mockDb);
      
      // Access private method for testing
      const preprocessQuery = (service as any).preprocessQuery.bind(service);
      
      expect(preprocessQuery('js')).toBe('javascript');
      expect(preprocessQuery('ts')).toBe('typescript');
      expect(preprocessQuery('nodejs')).toBe('node');
    });

    it('should clean and normalize query', () => {
      const service = new SearchMatchingService(mockDb);
      
      const preprocessQuery = (service as any).preprocessQuery.bind(service);
      
      expect(preprocessQuery('  React.js  ')).toBe('reactjavascript');
      expect(preprocessQuery('Vue@3')).toBe('vue3');
    });
  });

  describe('generateSearchVariations', () => {
    it('should generate fuzzy variations', () => {
      const service = new SearchMatchingService(mockDb);
      
      const generateSearchVariations = (service as any).generateSearchVariations.bind(service);
      
      const variations = generateSearchVariations('react');
      
      expect(variations.exact).toContain('react');
      expect(variations.fuzzy.length).toBeGreaterThan(0);
    });

    it('should generate semantic variations', () => {
      const service = new SearchMatchingService(mockDb);
      
      const generateSearchVariations = (service as any).generateSearchVariations.bind(service);
      
      const variations = generateSearchVariations('button');
      
      expect(variations.semantic).toContain('btn');
      expect(variations.semantic).toContain('click');
    });
  });

  describe('mergeResults', () => {
    it('should merge results and keep highest score', () => {
      const service = new SearchMatchingService(mockDb);
      
      const mergeResults = (service as any).mergeResults.bind(service);
      
      const mockLibrary: Library = {
        id: '1',
        name: 'react',
        displayName: 'React',
        description: 'A JavaScript library',
        language: 'JavaScript'
      };

      const results: SearchResult[] = [
        {
          library: mockLibrary,
          score: 0.7,
          matchType: 'exact',
          matchDetails: { nameMatch: 0.8 },
          explanation: 'Exact match'
        },
        {
          library: mockLibrary,
          score: 0.9,
          matchType: 'fuzzy',
          matchDetails: { nameMatch: 0.9 },
          explanation: 'Fuzzy match'
        }
      ];

      const merged = mergeResults(results);

      expect(merged).toHaveLength(1);
      expect(merged[0].score).toBe(0.9);
      expect(merged[0].matchType).toBe('fuzzy');
    });
  });

  describe('calculateFacets', () => {
    it('should calculate facets from results', async () => {
      const service = new SearchMatchingService(mockDb);
      
      const calculateFacets = (service as any).calculateFacets.bind(service);
      
      const mockLibrary: Library = {
        id: '1',
        name: 'react',
        displayName: 'React',
        description: 'A JavaScript library',
        language: 'JavaScript',
        license: 'MIT',
        tags: [
          { id: '1', name: 'frontend', category: 'framework' },
          { id: '2', name: 'ui', category: 'component' }
        ]
      };

      const results: SearchResult[] = [
        {
          library: mockLibrary,
          score: 0.9,
          matchType: 'exact',
          matchDetails: {},
          explanation: 'Exact match'
        }
      ];

      const facets = await calculateFacets(results);

      expect(facets.tags).toHaveLength(2);
      expect(facets.languages).toHaveLength(1);
      expect(facets.licenses).toHaveLength(1);
      expect(facets.tags[0].name).toBe('frontend');
      expect(facets.languages[0].name).toBe('JavaScript');
      expect(facets.licenses[0].name).toBe('MIT');
    });

    it('should return empty facets for no results', async () => {
      const service = new SearchMatchingService(mockDb);
      
      const calculateFacets = (service as any).calculateFacets.bind(service);
      
      const facets = await calculateFacets([]);

      expect(facets.tags).toEqual([]);
      expect(facets.languages).toEqual([]);
      expect(facets.licenses).toEqual([]);
      expect(facets.categories).toEqual([]);
    });
  });
});
