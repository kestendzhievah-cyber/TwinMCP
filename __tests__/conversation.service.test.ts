import { ConversationService } from '../src/services/conversation.service';
import { Conversation, ConversationSearch, ConversationMessage } from '../src/types/conversation.types';

// Mocks pour les dépendances
const mockDb = {
  query: jest.fn(),
  // @ts-ignore
  on: jest.fn(),
  // @ts-ignore
  end: jest.fn(),
};

const mockRedis = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  // @ts-ignore
  quit: jest.fn(),
};

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationService(mockDb as any, mockRedis as any);
  });

  describe('createConversation', () => {
    it('should create a new conversation with default values', async () => {
      const userId = 'user123';
      const data = {
        title: 'Test Conversation',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      };

      // Mock de la base de données
      mockDb.query.mockResolvedValue({ rows: [] });
      mockRedis.setex.mockResolvedValue('OK');

      const conversation = await service.createConversation(userId, data);

      expect(conversation).toBeDefined();
      expect(conversation.title).toBe(data.title);
      expect(conversation.userId).toBe(userId);
      expect(conversation.metadata.provider).toBe(data.provider);
      expect(conversation.metadata.model).toBe(data.model);
      expect(conversation.messages).toHaveLength(0);
      expect(conversation.metadata.messageCount).toBe(0);
      expect(conversation.settings.temperature).toBe(0.7);
      expect(conversation.settings.streamResponse).toBe(true);
    });

    it('should create conversation with custom settings', async () => {
      const userId = 'user123';
      const data = {
        title: 'Custom Conversation',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        systemPrompt: 'You are a helpful assistant',
        settings: {
          temperature: 0.5,
          maxTokens: 1024,
          language: 'en'
        }
      };

      mockDb.query.mockResolvedValue({ rows: [] });
      mockRedis.setex.mockResolvedValue('OK');

      const conversation = await service.createConversation(userId, data);

      expect(conversation.settings.temperature).toBe(0.5);
      expect(conversation.settings.maxTokens).toBe(1024);
      expect(conversation.settings.language).toBe('en');
      expect(conversation.metadata.systemPrompt).toBe(data.systemPrompt);
    });
  });

  describe('getConversation', () => {
    it('should return conversation from cache if available', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const cachedConversation = {
        id: conversationId,
        userId,
        title: 'Cached Conversation',
        messages: [],
        metadata: {},
        settings: {},
        analytics: {}
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedConversation));

      const result = await service.getConversation(conversationId, userId);

      expect(result).toEqual(cachedConversation);
      expect(mockRedis.get).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should fetch conversation from database if not in cache', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const dbConversation = {
        id: conversationId,
        user_id: userId,
        title: 'DB Conversation',
        metadata: JSON.stringify({ provider: 'openai', model: 'gpt-4' }),
        settings: JSON.stringify({ temperature: 0.7 }),
        analytics: JSON.stringify({ views: 0 }),
        messages: []
      };

      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [dbConversation] });
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getConversation(conversationId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(conversationId);
      expect(result?.userId).toBe(userId);
      expect(mockDb.query).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return null if conversation not found', async () => {
      const conversationId = 'nonexistent';
      const userId = 'user123';

      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.getConversation(conversationId, userId);

      expect(result).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('should add a message to conversation', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const messageData = {
        role: 'user' as const,
        content: 'Hello, world!',
        metadata: { tokens: 10, cost: 0.001 },
        timestamp: new Date(),
        reactions: [],
        attachments: []
      };

      mockDb.query.mockResolvedValue({ rows: [] });
      mockRedis.del.mockResolvedValue(1);

      const message = await service.addMessage(conversationId, userId, messageData);

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.conversationId).toBe(conversationId);
      expect(message.role).toBe(messageData.role);
      expect(message.content).toBe(messageData.content);
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.reactions).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(2); // saveMessage + updateConversation
      expect(mockRedis.del).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('should handle message with attachments', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const attachments = [
        {
          id: 'att1',
          messageId: '',
          type: 'image' as const,
          name: 'test.png',
          url: 'https://example.com/test.png',
          size: 1024
        }
      ];

      const messageData = {
        role: 'user' as const,
        content: 'Check this image',
        metadata: {},
        timestamp: new Date(),
        reactions: [],
        attachments
      };

      mockDb.query.mockResolvedValue({ rows: [] });
      mockRedis.del.mockResolvedValue(1);

      const message = await service.addMessage(conversationId, userId, messageData);

      expect(message.attachments).toEqual(attachments);
    });
  });

  describe('searchConversations', () => {
    it('should search conversations with basic query', async () => {
      const userId = 'user123';
      const search: ConversationSearch = {
        query: 'test',
        filters: {},
        sorting: {
          field: 'updatedAt',
          order: 'desc'
        },
        pagination: {
          page: 1,
          limit: 10,
          offset: 0
        }
      };

      const mockConversations = [
        {
          id: 'conv1',
          title: 'Test Conversation 1',
          user_id: userId,
          metadata: '{}',
          settings: '{}',
          analytics: '{}'
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockConversations }) // conversations query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] }); // count query

      const result = await service.searchConversations(userId, search);

      expect(result.conversations).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.facets).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should apply filters correctly', async () => {
      const userId = 'user123';
      const search: ConversationSearch = {
        query: '',
        filters: {
          providers: ['openai'],
          isPinned: true,
          tags: ['important']
        },
        sorting: {
          field: 'createdAt',
          order: 'desc'
        },
        pagination: {
          page: 1,
          limit: 20,
          offset: 0
        }
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] });

      await service.searchConversations(userId, search);

      // Vérifier que les filtres sont bien appliqués dans la requête
      const calls = mockDb.query.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      // La requête doit contenir les filtres
      const query = calls[0][0];
      expect(query).toContain('c.metadata->>\'provider\' = ANY');
      expect(query).toContain('(c.metadata->>\'isPinned\')::boolean');
      expect(query).toContain('c.metadata->\'tags\' ?|');
    });
  });

  describe('shareConversation', () => {
    it('should create a share link for conversation', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const options = {
        permissions: { canView: true, canDownload: false },
        settings: { includeMetadata: true, watermark: false }
      };

      const mockConversation = {
        id: conversationId,
        userId,
        title: 'Shareable Conversation',
        messages: [],
        metadata: {},
        settings: {},
        analytics: {}
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockConversation] }) // getConversation
        .mockResolvedValueOnce({ rows: [] }) // saveShare
        .mockResolvedValueOnce({ rows: [] }); // updateConversation

      const share = await service.shareConversation(conversationId, userId, options);

      expect(share).toBeDefined();
      expect(share.conversationId).toBe(conversationId);
      expect(share.createdBy).toBe(userId);
      expect(share.shareId).toBeDefined();
      expect(share.permissions).toEqual({ canView: true, canComment: false, canShare: false, canDownload: false });
      expect(share.analytics.views).toBe(0);
    });

    it('should throw error if conversation not found', async () => {
      const conversationId = 'nonexistent';
      const userId = 'user123';

      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(
        service.shareConversation(conversationId, userId, {
          permissions: {},
          settings: {}
        })
      ).rejects.toThrow('Conversation not found');
    });
  });

  describe('exportConversation', () => {
    it('should create an export request', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const format = 'json' as const;
      const options = {
        includeMetadata: true,
        includeAnalytics: false,
        includeAttachments: true,
        compressImages: false
      };

      const mockConversation = {
        id: conversationId,
        userId,
        title: 'Exportable Conversation',
        messages: [],
        metadata: {},
        settings: {},
        analytics: {}
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockConversation] }) // getConversation
        .mockResolvedValueOnce({ rows: [] }); // saveExport

      const exportRecord = await service.exportConversation(conversationId, userId, format, options);

      expect(exportRecord).toBeDefined();
      expect(exportRecord.conversationId).toBe(conversationId);
      expect(exportRecord.format).toBe(format);
      expect(exportRecord.status).toBe('pending');
      expect(exportRecord.options.includeMetadata).toBe(true);
      expect(exportRecord.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid format', async () => {
      const conversationId = 'conv123';
      const userId = 'user123';
      const format = 'invalid' as any;

      const mockConversation = {
        id: conversationId,
        userId,
        title: 'Test',
        messages: [],
        metadata: {},
        settings: {},
        analytics: {}
      };

      mockDb.query.mockResolvedValue({ rows: [mockConversation] });
      mockDb.query.mockResolvedValue({ rows: [] });

      // Le service devrait valider le format
      await expect(
        service.exportConversation(conversationId, userId, format, {
          includeMetadata: true,
          includeAnalytics: false,
          includeAttachments: true,
          compressImages: false
        })
      ).rejects.toThrow();
    });
  });

  describe('getSharedConversation', () => {
    it('should return shared conversation', async () => {
      const shareId = 'share123';
      const mockShare = {
        id: 'shareId',
        conversation_id: 'conv123',
        share_id: shareId,
        created_by: 'user123',
        created_at: new Date(),
        permissions: '{}',
        settings: '{}',
        analytics: '{"views": 0}'
      };

      const mockConversation = {
        id: 'conv123',
        userId: 'user123',
        title: 'Shared Conversation',
        messages: [],
        metadata: {},
        settings: {},
        analytics: {}
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockShare] }) // getShare
        .mockResolvedValueOnce({ rows: [mockShare] }) // increment views
        .mockResolvedValueOnce({ rows: [mockConversation] }); // getConversation

      const result = await service.getSharedConversation(shareId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('conv123');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should return null for expired or non-existent share', async () => {
      const shareId = 'expired';

      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.getSharedConversation(shareId);

      expect(result).toBeNull();
    });
  });
});
