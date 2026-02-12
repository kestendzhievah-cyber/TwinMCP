import { LibraryIndexService } from '../src/services/library-index.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');

describe('LibraryIndexService', () => {
  let service: LibraryIndexService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockDb = new Pool() as jest.Mocked<Pool>;
    mockRedis = new Redis() as jest.Mocked<Redis>;
    
    service = new LibraryIndexService(mockDb, mockRedis);
  });

  describe('searchLibraries', () => {
    it('should return relevant results for text search', async () => {
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

      const mockFacets = {
        tags: [{ name: 'frontend', count: 100 }],
        languages: [{ name: 'JavaScript', count: 500 }],
        licenses: [{ name: 'MIT', count: 300 }]
      };

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: mockLibraries })
        .mockResolvedValueOnce({ rows: mockFacets.tags })
        .mockResolvedValueOnce({ rows: mockFacets.languages })
        .mockResolvedValueOnce({ rows: mockFacets.licenses })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.keys = jest.fn().mockResolvedValue([]);
      mockRedis.del = jest.fn().mockResolvedValue(1);

      const result = await service.searchLibraries({
        q: 'react',
        limit: 10
      });

      expect(result.libraries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.facets).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should filter by tags', async () => {
      const mockLibraries = [
        {
          id: '1',
          name: 'express',
          display_name: 'Express',
          description: 'Fast, unopinionated web framework',
          total_downloads: 500000,
          weekly_downloads: 25000,
          stars: 60000,
          forks: 15000,
          issues: 500,
          language: 'JavaScript',
          status: 'active',
          quality_score: 0.8,
          popularity_score: 0.9,
          maintenance_score: 0.75,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: mockLibraries })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await service.searchLibraries({
        tags: ['backend', 'nodejs'],
        limit: 5
      });

      expect(result.libraries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getLibraryByName', () => {
    it('should return library with caching', async () => {
      const mockLibrary = {
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
      };

      // First call - cache miss
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockDb.query = jest.fn().mockResolvedValue({ rows: [mockLibrary] });
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const library1 = await service.getLibraryByName('react');
      expect(library1).toBeDefined();
      expect(mockRedis.get).toHaveBeenCalledWith('library:name:react');
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM libraries WHERE name = $1', ['react']);
      expect(mockRedis.setex).toHaveBeenCalledWith('library:name:react', 3600, JSON.stringify(mockLibrary));

      // Second call - cache hit
      mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify(mockLibrary));
      
      const library2 = await service.getLibraryByName('react');
      expect(library2).toEqual(library1);
    });

    it('should return null when library not found', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] });

      const library = await service.getLibraryByName('nonexistent');
      expect(library).toBeNull();
    });
  });

  describe('getLibraryVersions', () => {
    it('should return library versions with caching', async () => {
      const mockVersions = [
        {
          id: '1',
          library_id: '1',
          version: '18.2.0',
          is_latest: true,
          is_prerelease: false,
          release_date: new Date(),
          downloads: 1000000,
          deprecated: false,
          created_at: new Date()
        },
        {
          id: '2',
          library_id: '1',
          version: '18.1.0',
          is_latest: false,
          is_prerelease: false,
          release_date: new Date(),
          downloads: 500000,
          deprecated: false,
          created_at: new Date()
        }
      ];

      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockDb.query = jest.fn().mockResolvedValue({ rows: mockVersions });
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const versions = await service.getLibraryVersions('1');
      
      expect(versions).toHaveLength(2);
      expect(versions[0]?.version).toBe('18.2.0');
      expect(versions[0]?.isLatest).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith('library:versions:1', 1800, JSON.stringify(mockVersions));
    });
  });

  describe('getLibraryDependencies', () => {
    it('should return library dependencies', async () => {
      const mockDependencies = [
        {
          id: '1',
          library_id: '1',
          dependency_library_id: '2',
          dependency_name: 'lodash',
          version_range: '^4.17.21',
          dependency_type: 'dependencies',
          is_external: false,
          created_at: new Date(),
          dependency_library_name: 'lodash'
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockDependencies });

      const dependencies = await service.getLibraryDependencies('1');
      
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.dependencyName).toBe('lodash');
      expect(dependencies[0]?.dependencyType).toBe('dependencies');
    });
  });

  describe('getLibraryTags', () => {
    it('should return library tags', async () => {
      const mockTags = [
        {
          id: '1',
          name: 'frontend',
          category: 'framework',
          description: 'Frontend framework',
          color: '#61dafb',
          created_at: new Date()
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockTags });

      const tags = await service.getLibraryTags('1');
      
      expect(tags).toHaveLength(1);
      expect(tags[0]?.name).toBe('frontend');
      expect(tags[0]?.category).toBe('framework');
    });
  });

  describe('getLibraryMaintainers', () => {
    it('should return library maintainers', async () => {
      const mockMaintainers = [
        {
          id: '1',
          github_username: 'facebook',
          npm_username: 'facebook',
          name: 'Facebook',
          email: 'opensource@fb.com',
          avatar_url: 'https://github.com/facebook.png',
          followers: 10000,
          following: 0,
          public_repos: 100,
          role: 'owner',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockMaintainers });

      const maintainers = await service.getLibraryMaintainers('1');
      
      expect(maintainers).toHaveLength(1);
      expect(maintainers[0]?.githubUsername).toBe('facebook');
      expect(maintainers[0]?.role).toBe('owner');
    });
  });

  describe('indexLibrary', () => {
    it('should create a new library', async () => {
      const libraryData = {
        name: 'test-library',
        displayName: 'Test Library',
        description: 'A test library',
        language: 'JavaScript',
        status: 'active' as const,
        qualityScore: 0.8,
        popularityScore: 0.7,
        maintenanceScore: 0.75
      };

      const mockLibrary = {
        id: '1',
        name: 'test-library',
        display_name: 'Test Library',
        description: 'A test library',
        language: 'JavaScript',
        status: 'active',
        quality_score: 0.8,
        popularity_score: 0.7,
        maintenance_score: 0.75,
        total_downloads: 0,
        weekly_downloads: 0,
        stars: 0,
        forks: 0,
        issues: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [mockLibrary] }),
        release: jest.fn()
      };

      mockDb.connect = jest.fn().mockResolvedValue(mockClient);
      mockRedis.keys = jest.fn().mockResolvedValue([]);
      mockRedis.del = jest.fn().mockResolvedValue(1);

      const result = await service.indexLibrary(libraryData);
      
      expect(result).toEqual(mockLibrary);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO libraries'), expect.any(Array));
      expect(mockRedis.keys).toHaveBeenCalled();
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestions = ['react', 'react-dom', 'react-native'];
      
      mockDb.query = jest.fn().mockResolvedValue({ 
        rows: mockSuggestions.map(name => ({ name })) 
      });

      const suggestions = await service.getSearchSuggestions('rea');
      
      expect(suggestions).toEqual(mockSuggestions);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT name'),
        ['rea']
      );
    });
  });
});
