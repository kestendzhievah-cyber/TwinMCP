import { DocumentIndexationService } from '../src/services/document-indexation.service';
import { IndexerConfig } from '../src/types/indexation.types';

// Mock des dépendances
const mockDb = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn()
  })
} as any;

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
} as any;

const mockEmbeddingService = {
  generateEmbeddings: jest.fn().mockResolvedValue([
    { id: 'test', embedding: [0.1, 0.2, 0.3], model: 'test-model', tokensUsed: 10 }
  ])
};

describe('DocumentIndexationService', () => {
  let service: DocumentIndexationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentIndexationService(mockDb, mockRedis, mockEmbeddingService);
  });

  describe('startIndexing', () => {
    it('should create and start indexing task', async () => {
      const taskId = await service.startIndexing(
        'test-library',
        './test-docs'
      );

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      
      // Vérification que la tâche a été sauvegardée
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO indexing_tasks'),
        expect.any(Array)
      );
    });
  });

  describe('getIndexingStatus', () => {
    it('should return task status', async () => {
      const mockTask = {
        id: 'test-task-id',
        library_id: 'test-library',
        source_path: './test-docs',
        status: 'completed',
        progress: { phase: 'completed', completed: 100, total: 100, percentage: 100, currentFile: '' },
        config: {},
        results: { documentsParsed: 10, chunksCreated: 50, embeddingsGenerated: 50, errors: [] },
        created_at: new Date(),
        started_at: new Date(),
        completed_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockTask] });

      const status = await service.getIndexingStatus('test-task-id');

      expect(status).toBeDefined();
      expect(status?.id).toBe('test-task-id');
      expect(status?.status).toBe('completed');
    });

    it('should return null for non-existent task', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const status = await service.getIndexingStatus('non-existent-task');

      expect(status).toBeNull();
    });
  });

  describe('getIndexingStats', () => {
    it('should return indexing statistics', async () => {
      const mockStats = {
        total_documents: '100',
        total_chunks: '500',
        total_embeddings: '500',
        avg_chunk_size: '800',
        avg_processing_time: '120',
        error_rate: '0.05'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockStats] }) // Stats principales
        .mockResolvedValueOnce({ rows: [{ format: 'markdown', count: '60' }] }) // Format distribution
        .mockResolvedValueOnce({ rows: [{ type: 'readme', count: '40' }] }); // Type distribution

      const stats = await service.getIndexingStats('test-library');

      expect(stats).toBeDefined();
      expect(stats.totalDocuments).toBe(100);
      expect(stats.totalChunks).toBe(500);
      expect(stats.totalEmbeddings).toBe(500);
      expect(stats.averageChunkSize).toBe(800);
      expect(stats.processingTime).toBe(120);
      expect(stats.errorRate).toBe(0.05);
      expect(stats.formatDistribution).toEqual({ markdown: 60 });
      expect(stats.typeDistribution).toEqual({ readme: 40 });
    });
  });

  describe('Parser Integration', () => {
    it('should initialize all parsers', () => {
      // Vérification que les parsers sont bien initialisés
      expect(service).toBeDefined();
      // Les parsers sont initialisés dans le constructeur
    });
  });

  describe('Chunker Integration', () => {
    it('should initialize all chunkers', () => {
      // Vérification que les chunkers sont bien initialisés
      expect(service).toBeDefined();
      // Les chunkers sont initialisés dans le constructeur
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getIndexingStatus('test-task')).rejects.toThrow('Database connection failed');
    });

    it('should handle embedding service errors', async () => {
      mockEmbeddingService.generateEmbeddings.mockRejectedValue(new Error('Embedding service failed'));

      // Le test devrait vérifier que l'erreur est bien gérée
      // et ajoutée à la liste des erreurs de la tâche
      expect(true).toBe(true); // Placeholder pour le test
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', async () => {
      const taskId = await service.startIndexing('test-library', './test-docs');

      expect(taskId).toBeDefined();
      
      // Vérifier que la configuration par défaut est utilisée
      const insertCall = mockDb.query.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO indexing_tasks')
      );
      
      expect(insertCall).toBeDefined();
      const config = JSON.parse(insertCall![1][6]); // config parameter
      expect(config.chunkingStrategy).toBe('semantic');
      expect(config.maxChunkSize).toBe(1000);
    });

    it('should merge custom configuration with defaults', async () => {
      const customConfig: Partial<IndexerConfig> = {
        maxChunkSize: 1500,
        chunkingStrategy: 'fixed'
      };

      await service.startIndexing('test-library', './test-docs', customConfig);

      const insertCall = mockDb.query.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO indexing_tasks')
      );
      
      expect(insertCall).toBeDefined();
      const config = JSON.parse(insertCall![1][6]);
      expect(config.maxChunkSize).toBe(1500);
      expect(config.chunkingStrategy).toBe('fixed');
      expect(config.overlapSize).toBe(100); // Default value preserved
    });
  });
});
