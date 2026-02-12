import { VectorStoreService } from '../services/vector-store.service';
import { EmbeddingsService } from '../services/embeddings.service';

describe('Vector Store Service', () => {
  let vectorStoreService: VectorStoreService;
  let embeddingsService: EmbeddingsService;

  beforeAll(async () => {
    vectorStoreService = new VectorStoreService();
    embeddingsService = new EmbeddingsService();
    
    // Skip tests si pas de clé API
    if (!process.env['OPENAI_API_KEY']) {
      console.warn('Skipping vector store tests - no OpenAI API key');
      return;
    }

    await vectorStoreService.initialize();
  });

  afterAll(async () => {
    // Nettoyer les données de test si nécessaire
  });

  describe('Embeddings Service', () => {
    it('should generate embedding for text', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      const text = 'This is a test document for embedding generation';
      const embedding = await embeddingsService.generateEmbedding(text);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536); // OpenAI text-embedding-3-small
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should generate batch embeddings', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      const texts = [
        'First test document',
        'Second test document',
        'Third test document',
      ];

      const embeddings = await embeddingsService.generateBatchEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(1536);
        expect(embedding.every(val => typeof val === 'number')).toBe(true);
      });
    });

    it('should cache embeddings', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      const text = 'Cache test document';
      
      // Premier appel
      const start1 = Date.now();
      const embedding1 = await embeddingsService.generateEmbedding(text);
      const time1 = Date.now() - start1;

      // Deuxième appel (devrait être plus rapide)
      const start2 = Date.now();
      const embedding2 = await embeddingsService.generateEmbedding(text);
      const time2 = Date.now() - start2;

      expect(embedding1).toEqual(embedding2);
      expect(time2).toBeLessThan(time1); // Cache devrait être plus rapide
    });
  });

  describe('Vector Store Operations', () => {
    const testMetadata = {
      libraryId: '/test/library',
      version: '1.0.0',
      contentType: 'guide' as const,
      sourceUrl: 'https://example.com/doc',
      section: 'Introduction',
      tokenCount: 100,
    };

    it('should add document to vector store', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      const content = 'This is a test document for vector store';
      const id = await vectorStoreService.addDocument(content, testMetadata);

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should search documents', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      // Ajouter un document de test
      await vectorStoreService.addDocument(
        'MongoDB is a NoSQL database that stores data in flexible documents',
        {
          ...testMetadata,
          libraryId: '/mongodb/docs',
        }
      );

      // Rechercher
      const results = await vectorStoreService.search('MongoDB database', {
        topK: 5,
        libraryId: '/mongodb/docs',
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('score');
        expect(result.metadata.libraryId).toBe('/mongodb/docs');
      });
    });

    it('should filter search results', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      // Ajouter des documents de différents types
      await vectorStoreService.addDocument(
        'Code snippet example',
        {
          ...testMetadata,
          libraryId: '/test/snippets',
          contentType: 'snippet',
        }
      );

      await vectorStoreService.addDocument(
        'API reference documentation',
        {
          ...testMetadata,
          libraryId: '/test/api',
          contentType: 'api_ref',
        }
      );

      // Rechercher par type
      const snippetResults = await vectorStoreService.search('example', {
        topK: 10,
        contentType: 'snippet',
      });

      expect(snippetResults.every(r => r.metadata.contentType === 'snippet')).toBe(true);
    });

    it('should delete documents', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      // Ajouter un document
      const content = 'Document to delete';
      const id = await vectorStoreService.addDocument(content, testMetadata);

      // Supprimer
      await vectorStoreService.deleteDocuments([id]);

      // Vérifier qu'il n'est plus trouvé
      const results = await vectorStoreService.search('delete', {
        topK: 10,
      });

      const deletedDoc = results.find(r => r.id === id);
      expect(deletedDoc).toBeUndefined();
    });
  });

  describe('Health Checks', () => {
    it('should pass health check', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      const isHealthy = await vectorStoreService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should get stats', async () => {
      if (!process.env['OPENAI_API_KEY']) return;

      const stats = await vectorStoreService.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });
  });
});
