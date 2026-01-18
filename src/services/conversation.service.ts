import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { 
  Conversation, 
  ConversationMessage, 
  ConversationSearch,
  ConversationSearchResult,
  ConversationShare,
  ConversationExport,
  ConversationSettings
} from '../types/conversation.types';

export class ConversationService {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  async createConversation(
    userId: string,
    data: {
      title: string;
      provider: string;
      model: string;
      systemPrompt?: string;
      settings?: Partial<ConversationSettings>;
    }
  ): Promise<Conversation> {
    const conversationId = crypto.randomUUID();
    const now = new Date();

    const conversation: Conversation = {
      id: conversationId,
      title: data.title,
      userId,
      messages: [],
      metadata: {
        provider: data.provider,
        model: data.model,
        systemPrompt: data.systemPrompt,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        tags: [],
        category: 'general',
        isPinned: false,
        isArchived: false,
        isShared: false
      },
      settings: {
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
        includeContext: false,
        contextSources: [],
        autoSave: true,
        shareEnabled: true,
        notifications: true,
        language: 'fr',
        theme: 'auto',
        ...data.settings
      },
      analytics: {
        views: 0,
        shares: 0,
        exports: 0,
        averageSessionDuration: 0,
        userSatisfaction: 0,
        responseQuality: 0,
        tokenEfficiency: 0,
        costEfficiency: 0
      }
    };

    await this.saveConversation(conversation);
    await this.cacheConversation(conversation);

    return conversation;
  }

  async getConversation(conversationId: string, userId?: string): Promise<Conversation | null> {
    // Vérification du cache
    const cached = await this.getCachedConversation(conversationId);
    if (cached) {
      if (!userId || cached.userId === userId) {
        return cached;
      }
    }

    // Recherche en base
    const result = await this.db.query(`
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'id', m.id,
            'conversationId', m.conversation_id,
            'role', m.role,
            'content', m.content,
            'timestamp', m.timestamp,
            'metadata', m.metadata,
            'reactions', (
              SELECT json_agg(
                json_build_object(
                  'id', r.id,
                  'messageId', r.message_id,
                  'userId', r.user_id,
                  'emoji', r.emoji,
                  'timestamp', r.timestamp
                )
              )
              FROM message_reactions r
              WHERE r.message_id = m.id
            ),
            'attachments', (
              SELECT json_agg(
                json_build_object(
                  'id', a.id,
                  'messageId', a.message_id,
                  'type', a.type,
                  'name', a.name,
                  'url', a.url,
                  'size', a.size,
                  'mimeType', a.mime_type,
                  'metadata', a.metadata,
                  'thumbnail', a.thumbnail
                )
              )
              FROM message_attachments a
              WHERE a.message_id = m.id
            )
          )
          ORDER BY m.timestamp
        ) as messages
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.id = $1 ${userId ? 'AND c.user_id = $2' : ''}
      GROUP BY c.id
    `, userId ? [conversationId, userId] : [conversationId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const conversation = this.mapRowToConversation(row);

    // Mise en cache
    if (!userId || conversation.userId === userId) {
      await this.cacheConversation(conversation);
    }

    return conversation;
  }

  async updateConversation(
    conversationId: string,
    userId: string,
    updates: Partial<Conversation>
  ): Promise<Conversation> {
    const existing = await this.getConversation(conversationId, userId);
    if (!existing) {
      throw new Error('Conversation not found');
    }

    const updated: Conversation = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    };

    await this.saveConversation(updated);
    await this.cacheConversation(updated);

    return updated;
  }

  async addMessage(
    conversationId: string,
    userId: string,
    message: Omit<ConversationMessage, 'id' | 'conversationId'>
  ): Promise<ConversationMessage> {
    const messageId = crypto.randomUUID();
    const now = new Date();

    const newMessage: ConversationMessage = {
      id: messageId,
      conversationId,
      ...message,
      timestamp: now,
      reactions: [],
      attachments: message.attachments || []
    };

    // Sauvegarde du message
    await this.saveMessage(newMessage);

    // Mise à jour de la conversation
    await this.db.query(`
      UPDATE conversations 
      SET 
        metadata = metadata || jsonb_build_object(
          'lastMessageAt', $1,
          'messageCount', (metadata->>'messageCount')::int + 1,
          'totalTokens', COALESCE((metadata->>'totalTokens')::int, 0) + COALESCE($2, 0),
          'totalCost', COALESCE((metadata->>'totalCost')::float, 0) + COALESCE($3, 0),
          'updatedAt', $1
        )
      WHERE id = $4
    `, [now, message.metadata?.tokens, message.metadata?.cost, conversationId]);

    // Invalidation du cache
    await this.invalidateConversationCache(conversationId);

    return newMessage;
  }

  async searchConversations(
    userId: string,
    search: ConversationSearch
  ): Promise<ConversationSearchResult> {
    let whereClause = 'WHERE c.user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    // Construction des filtres
    if (search.query) {
      whereClause += ` AND (
        c.title ILIKE $${paramIndex} OR 
        EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id AND m.content ILIKE $${paramIndex}
        )
      )`;
      params.push(`%${search.query}%`);
      paramIndex++;
    }

    if (search.filters.dateRange) {
      whereClause += ` AND c.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(search.filters.dateRange.start, search.filters.dateRange.end);
      paramIndex += 2;
    }

    if (search.filters.providers?.length) {
      whereClause += ` AND c.metadata->>'provider' = ANY($${paramIndex})`;
      params.push(search.filters.providers);
      paramIndex++;
    }

    if (search.filters.tags?.length) {
      whereClause += ` AND c.metadata->'tags' ?| $${paramIndex}`;
      params.push(search.filters.tags);
      paramIndex++;
    }

    if (search.filters.isPinned !== undefined) {
      whereClause += ` AND (c.metadata->>'isPinned')::boolean = $${paramIndex}`;
      params.push(search.filters.isPinned);
      paramIndex++;
    }

    if (search.filters.isArchived !== undefined) {
      whereClause += ` AND (c.metadata->>'isArchived')::boolean = $${paramIndex}`;
      params.push(search.filters.isArchived);
      paramIndex++;
    }

    // Tri
    const orderClause = `ORDER BY c.metadata->>'${search.sorting.field}' ${search.sorting.order}`;

    // Pagination
    const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(search.pagination.limit, search.pagination.offset);

    // Requête principale
    const conversationsQuery = `
      SELECT 
        c.*,
        ts_rank(
          to_tsvector('french', c.title || ' ' || COALESCE(
            string_agg(m.content, ' '), ''
          )),
          plainto_tsquery('french', $1)
        ) as relevance_score
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      ${whereClause}
      GROUP BY c.id
      ${orderClause}
      ${limitClause}
    `;

    const conversationsResult = await this.db.query(conversationsQuery, params);

    // Comptage total
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      ${whereClause}
    `;

    const countResult = await this.db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // Facettes
    const facets = await this.getSearchFacets(userId, search);

    // Suggestions
    const suggestions = await this.getSearchSuggestions(userId, search.query);

    return {
      conversations: conversationsResult.rows.map(row => this.mapRowToConversation(row)),
      total,
      facets,
      suggestions
    };
  }

  async shareConversation(
    conversationId: string,
    userId: string,
    options: {
      expiresAt?: Date;
      permissions: Partial<ConversationShare['permissions']>;
      settings: Partial<ConversationShare['settings']>;
    }
  ): Promise<ConversationShare> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const shareId = crypto.randomUUID();
    const share: ConversationShare = {
      id: crypto.randomUUID(),
      conversationId,
      shareId,
      createdBy: userId,
      createdAt: new Date(),
      expiresAt: options.expiresAt,
      permissions: {
        canView: true,
        canComment: false,
        canShare: false,
        canDownload: false,
        ...options.permissions
      },
      settings: {
        includeMetadata: true,
        includeAnalytics: false,
        watermark: false,
        ...options.settings
      },
      analytics: {
        views: 0,
        downloads: 0,
        comments: 0
      }
    };

    await this.saveShare(share);
    
    // Mise à jour de la conversation
    await this.updateConversation(conversationId, userId, {
      metadata: {
        ...conversation.metadata,
        isShared: true,
        shareId: share.shareId,
        shareExpiry: options.expiresAt
      }
    });

    return share;
  }

  async getSharedConversation(shareId: string): Promise<Conversation | null> {
    const shareResult = await this.db.query(
      'SELECT * FROM conversation_shares WHERE share_id = $1 AND (expires_at IS NULL OR expires_at > NOW())',
      [shareId]
    );

    if (shareResult.rows.length === 0) return null;

    const share = shareResult.rows[0];

    // Incrémentation du compteur de vues
    await this.db.query(
      'UPDATE conversation_shares SET analytics = analytics || jsonb_build_object(\'views\', (analytics->>\'views\')::int + 1) WHERE id = $1',
      [share.id]
    );

    // Récupération de la conversation
    const conversation = await this.getConversation(share.conversation_id);
    if (!conversation) return null;

    // Application des permissions et settings
    if (share.settings.watermark) {
      // Ajout du watermark
      conversation.messages = conversation.messages.map(msg => ({
        ...msg,
        content: `${msg.content}\n\n---\n*Partagé via TwinMe IA*`
      }));
    }

    return conversation;
  }

  async exportConversation(
    conversationId: string,
    userId: string,
    format: ConversationExport['format'],
    options: ConversationExport['options']
  ): Promise<ConversationExport> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const exportRecord: ConversationExport = {
      id: crypto.randomUUID(),
      conversationId,
      format,
      options,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    };

    await this.saveExport(exportRecord);

    // Traitement asynchrone
    this.processExport(exportRecord.id, conversation).catch(console.error);

    return exportRecord;
  }

  private async processExport(exportId: string, conversation: Conversation): Promise<void> {
    try {
      const exportRecord = await this.getExport(exportId);
      if (!exportRecord) return;

      exportRecord.status = 'processing';
      await this.saveExport(exportRecord);

      let content: string;
      let mimeType: string;
      let extension: string;

      switch (exportRecord.format) {
        case 'json':
          content = JSON.stringify(conversation, null, 2);
          mimeType = 'application/json';
          extension = '.json';
          break;
          
        case 'markdown':
          content = this.convertToMarkdown(conversation, exportRecord);
          mimeType = 'text/markdown';
          extension = '.md';
          break;
          
        case 'html':
          content = this.convertToHTML(conversation);
          mimeType = 'text/html';
          extension = '.html';
          break;
          
        case 'pdf':
          content = await this.convertToPDF(conversation);
          mimeType = 'application/pdf';
          extension = '.pdf';
          break;
          
        default:
          throw new Error(`Unsupported format: ${exportRecord.format}`);
      }

      // Upload vers le stockage
      const filename = `conversation-${conversation.id}-${Date.now()}${extension}`;
      const downloadUrl = await this.uploadExport(filename, content, mimeType);

      exportRecord.status = 'completed';
      exportRecord.downloadUrl = downloadUrl;
      exportRecord.completedAt = new Date();

      await this.saveExport(exportRecord);

    } catch (error: any) {
      const exportRecord = await this.getExport(exportId);
      if (exportRecord) {
        exportRecord.status = 'failed';
        exportRecord.error = error.message;
        await this.saveExport(exportRecord);
      }
    }
  }

  private convertToMarkdown(conversation: Conversation, exportRecord: ConversationExport): string {
    let markdown = `# ${conversation.title}\n\n`;
    
    if (exportRecord.options.includeMetadata) {
      markdown += `**Créée le:** ${conversation.metadata.createdAt.toLocaleDateString()}\n`;
      markdown += `**Provider:** ${conversation.metadata.provider}\n`;
      markdown += `**Modèle:** ${conversation.metadata.model}\n`;
      markdown += `**Messages:** ${conversation.metadata.messageCount}\n`;
      markdown += `**Tokens:** ${conversation.metadata.totalTokens}\n\n`;
    }

    markdown += '---\n\n';

    for (const message of conversation.messages) {
      const role = message.role === 'user' ? '👤 **Utilisateur**' : '🤖 **Assistant**';
      markdown += `${role} - ${message.timestamp.toLocaleString()}\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (message.attachments.length > 0) {
        markdown += '**Pièces jointes:**\n';
        for (const attachment of message.attachments) {
          markdown += `- [${attachment.name}](${attachment.url})\n`;
        }
        markdown += '\n';
      }
      
      markdown += '---\n\n';
    }

    return markdown;
  }

  private convertToHTML(conversation: Conversation): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${conversation.title}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
          .user { background-color: #e3f2fd; }
          .assistant { background-color: #f3e5f5; }
          .metadata { color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <h1>${conversation.title}</h1>
        ${conversation.messages.map(msg => `
          <div class="message ${msg.role}">
            <div class="metadata">
              ${msg.role === 'user' ? '👤 Utilisateur' : '🤖 Assistant'} - ${msg.timestamp.toLocaleString()}
            </div>
            <div>${msg.content}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
  }

  private async convertToPDF(conversation: Conversation): Promise<string> {
    // Implémentation de la conversion PDF (utilise une librairie comme puppeteer)
    const html = this.convertToHTML(conversation);
    // Conversion HTML vers PDF
    return 'pdf-content';
  }

  private async uploadExport(filename: string, content: string, mimeType: string): Promise<string> {
    // Upload vers le stockage (S3, etc.)
    return `https://storage.example.com/exports/${filename}`;
  }

  // Méthodes utilitaires
  private async saveConversation(conversation: Conversation): Promise<void> {
    await this.db.query(`
      INSERT INTO conversations (
        id, user_id, title, metadata, settings, analytics
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        metadata = EXCLUDED.metadata,
        settings = EXCLUDED.settings,
        analytics = EXCLUDED.analytics
    `, [
      conversation.id,
      conversation.userId,
      conversation.title,
      JSON.stringify(conversation.metadata),
      JSON.stringify(conversation.settings),
      JSON.stringify(conversation.analytics)
    ]);
  }

  private async saveMessage(message: ConversationMessage): Promise<void> {
    await this.db.query(`
      INSERT INTO messages (
        id, conversation_id, role, content, timestamp, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
    `, [
      message.id,
      message.conversationId,
      message.role,
      message.content,
      message.timestamp,
      JSON.stringify(message.metadata)
    ]);
  }

  private async cacheConversation(conversation: Conversation): Promise<void> {
    await this.redis.setex(
      `conversation:${conversation.id}`,
      3600, // 1 heure
      JSON.stringify(conversation)
    );
  }

  private async getCachedConversation(conversationId: string): Promise<Conversation | null> {
    const cached = await this.redis.get(`conversation:${conversationId}`);
    return cached ? JSON.parse(cached) : null;
  }

  private async invalidateConversationCache(conversationId: string): Promise<void> {
    await this.redis.del(`conversation:${conversationId}`);
  }

  private async getSearchFacets(userId: string, search: ConversationSearch): Promise<any> {
    // Implémentation des facettes de recherche
    return {
      providers: [],
      models: [],
      tags: [],
      categories: []
    };
  }

  private async getSearchSuggestions(userId: string, query: string): Promise<string[]> {
    // Implémentation des suggestions de recherche
    return [];
  }

  private async saveShare(share: ConversationShare): Promise<void> {
    await this.db.query(`
      INSERT INTO conversation_shares (
        id, conversation_id, share_id, created_by, created_at,
        expires_at, permissions, settings, analytics
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
    `, [
      share.id,
      share.conversationId,
      share.shareId,
      share.createdBy,
      share.createdAt,
      share.expiresAt,
      JSON.stringify(share.permissions),
      JSON.stringify(share.settings),
      JSON.stringify(share.analytics)
    ]);
  }

  private async saveExport(exportRecord: ConversationExport): Promise<void> {
    await this.db.query(`
      INSERT INTO conversation_exports (
        id, conversation_id, format, options, status,
        download_url, expires_at, created_at, completed_at, error
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        download_url = EXCLUDED.download_url,
        completed_at = EXCLUDED.completed_at,
        error = EXCLUDED.error
    `, [
      exportRecord.id,
      exportRecord.conversationId,
      exportRecord.format,
      JSON.stringify(exportRecord.options),
      exportRecord.status,
      exportRecord.downloadUrl,
      exportRecord.expiresAt,
      exportRecord.createdAt,
      exportRecord.completedAt,
      exportRecord.error
    ]);
  }

  private async getExport(exportId: string): Promise<ConversationExport | null> {
    const result = await this.db.query(
      'SELECT * FROM conversation_exports WHERE id = $1',
      [exportId]
    );

    return result.rows[0] || null;
  }

  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      title: row.title,
      userId: row.user_id,
      messages: row.messages || [],
      metadata: JSON.parse(row.metadata),
      settings: JSON.parse(row.settings),
      analytics: JSON.parse(row.analytics)
    };
  }
}
