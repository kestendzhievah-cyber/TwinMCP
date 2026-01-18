import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { 
  StreamConnection, 
  StreamChunk, 
  StreamEvent, 
  StreamBuffer,
  StreamMetrics,
  StreamRequest,
  StreamResponse,
  StreamConfig,
  CompressionService,
  EncryptionService
} from '../types/streaming.types';
import { STREAMING_CONFIG } from '../config/streaming.config';
import { LLMService } from './llm.service';

export class StreamingService extends EventEmitter {
  private connections: Map<string, StreamConnection> = new Map();
  private buffers: Map<string, StreamBuffer> = new Map();
  private metrics: Map<string, StreamMetrics> = new Map();
  private connectionCount: number = 0;

  constructor(
    private db: Pool,
    private redis: Redis,
    private llmService: LLMService,
    private compressionService?: CompressionService,
    private encryptionService?: EncryptionService,
    private config: StreamConfig = STREAMING_CONFIG
  ) {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    // Nettoyage périodique des connexions expirées
    setInterval(() => {
      this.cleanupExpiredConnections();
    }, 60000); // 1 minute

    // Agrégation des métriques
    setInterval(() => {
      this.aggregateMetrics();
    }, this.config.monitoring.metricsInterval);

    // Heartbeat pour les connexions actives
    setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);
  }

  async createConnection(request: StreamRequest): Promise<StreamConnection> {
    // Vérification des limites
    if (this.connectionCount >= this.config.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const connectionId = randomBytes(16).toString('hex');
    const now = new Date();

    const connection: StreamConnection = {
      id: connectionId,
      clientId: request.clientId,
      userId: request.metadata.userId,
      sessionId: request.metadata.sessionId,
      requestId: request.id,
      status: 'connecting',
      provider: request.provider,
      model: request.model,
      metadata: {
        userAgent: '',
        ip: '',
        connectedAt: now,
        lastActivity: now,
        bytesReceived: 0,
        chunksReceived: 0,
        averageLatency: 0
      },
      options: {
        bufferSize: request.options.bufferSize || this.config.bufferSize,
        flushInterval: request.options.flushInterval || this.config.flushInterval,
        compression: this.config.compression.enabled,
        encryption: this.config.encryption.enabled,
        heartbeatInterval: this.config.heartbeatInterval
      },
      createdAt: now,
      updatedAt: now
    };

    // Initialisation du buffer
    const buffer: StreamBuffer = {
      connectionId: connectionId,
      chunks: [],
      maxSize: connection.options.bufferSize,
      flushThreshold: Math.floor(connection.options.bufferSize * 0.8),
      lastFlush: now,
      compressionEnabled: connection.options.compression
    };

    // Sauvegarde
    await this.saveConnection(connection);
    await this.saveBuffer(buffer);

    // Ajout aux maps
    this.connections.set(connectionId, connection);
    this.buffers.set(connectionId, buffer);
    this.connectionCount++;

    // Événement
    this.emit('connection_created', connection);

    return connection;
  }

  async startStream(connectionId: string, request: StreamRequest): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      connection.status = 'streaming';
      connection.updatedAt = new Date();
      await this.updateConnection(connection);

      // Envoi de l'événement de démarrage
      await this.sendEvent(connectionId, {
        type: 'start',
        data: {
          connectionId,
          provider: request.provider,
          model: request.model,
          timestamp: new Date()
        },
        timestamp: new Date(),
        eventId: randomBytes(8).toString('hex')
      });

      // Démarrage du streaming LLM
      const stream = await this.llmService.generateStream({
        id: request.id,
        provider: request.provider,
        model: request.model,
        messages: request.messages,
        context: request.context,
        options: request.options,
        metadata: {
          ...request.metadata,
          purpose: request.metadata.purpose as any,
          requestId: request.id
        },
        createdAt: new Date()
      });

      // Traitement du stream
      await this.processStream(connectionId, stream);

    } catch (error) {
      await this.handleStreamError(connectionId, error as Error);
    }
  }

  private async processStream(connectionId: string, stream: AsyncIterable<any>): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    let sequence = 0;
    let totalChunks = 0;
    let totalBytes = 0;
    const startTime = Date.now();

    try {
      for await (const chunk of stream) {
        const now = Date.now();
        const latency = now - startTime;

        // Création du chunk
        const streamChunk: StreamChunk = {
          id: randomBytes(8).toString('hex'),
          connectionId,
          sequence: sequence++,
          type: 'content',
          data: {
            content: chunk.content || '',
            delta: chunk.delta || '',
            finishReason: chunk.finishReason,
            usage: chunk.usage
          },
          timestamp: new Date(now),
          size: JSON.stringify(chunk).length
        };

        // Mise à jour des métriques
        totalChunks++;
        totalBytes += streamChunk.size;
        connection.metadata.chunksReceived = totalChunks;
        connection.metadata.bytesReceived = totalBytes;
        connection.metadata.averageLatency = latency / totalChunks;
        connection.metadata.lastActivity = new Date();

        // Ajout au buffer
        await this.addToBuffer(connectionId, streamChunk);

        // Envoi de l'événement de chunk
        await this.sendEvent(connectionId, {
          type: 'chunk',
          data: streamChunk.data,
          timestamp: new Date(),
          eventId: randomBytes(8).toString('hex')
        });

        // Vérification si le stream est terminé
        if (chunk.finishReason) {
          await this.completeStream(connectionId, chunk.finishReason);
          break;
        }
      }

    } catch (error) {
      await this.handleStreamError(connectionId, error as Error);
    }
  }

  private async addToBuffer(connectionId: string, chunk: StreamChunk): Promise<void> {
    const buffer = this.buffers.get(connectionId);
    if (!buffer) return;

    buffer.chunks.push(chunk);

    // Vérification du seuil de flush
    if (buffer.chunks.length >= buffer.flushThreshold || 
        buffer.chunks.reduce((sum, c) => sum + c.size, 0) >= buffer.maxSize) {
      await this.flushBuffer(connectionId);
    }
  }

  private async flushBuffer(connectionId: string): Promise<void> {
    const buffer = this.buffers.get(connectionId);
    if (!buffer || buffer.chunks.length === 0) return;

    try {
      // Compression si activée
      let chunksToFlush = buffer.chunks;
      if (buffer.compressionEnabled && this.compressionService) {
        chunksToFlush = await this.compressionService.compressChunks(buffer.chunks);
      }

      // Chiffrement si activé
      if (this.config.encryption.enabled && this.encryptionService) {
        chunksToFlush = await this.encryptionService.encryptChunks(chunksToFlush);
      }

      // Sauvegarde en base
      await this.saveChunks(chunksToFlush);

      // Nettoyage du buffer
      buffer.chunks = [];
      buffer.lastFlush = new Date();

      // Mise à jour du buffer
      await this.updateBuffer(buffer);

    } catch (error) {
      console.error(`Error flushing buffer for connection ${connectionId}:`, error);
    }
  }

  private async sendEvent(connectionId: string, event: StreamEvent): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'streaming') return;

    try {
      // Sérialisation de l'événement
      const eventData = this.formatSSEEvent(event);

      // Envoi via l'émetteur d'événements (pour le controller SSE)
      this.emit('stream_event', {
        connectionId,
        event: eventData
      });

      // Mise à jour de l'activité
      connection.metadata.lastActivity = new Date();
      await this.updateConnection(connection);

    } catch (error) {
      console.error(`Error sending event to connection ${connectionId}:`, error);
    }
  }

  private formatSSEEvent(event: StreamEvent): string {
    const lines = [
      `event: ${event.type}`,
      `id: ${event.eventId}`,
      `data: ${JSON.stringify(event.data)}`,
      `timestamp: ${event.timestamp.toISOString()}`,
      '', // Ligne vide pour terminer l'événement
      ''
    ];

    return lines.join('\n');
  }

  private async completeStream(connectionId: string, finishReason: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = 'completed';
    connection.updatedAt = new Date();

    await this.updateConnection(connection);

    // Flush final du buffer
    await this.flushBuffer(connectionId);

    // Envoi de l'événement de completion
    await this.sendEvent(connectionId, {
      type: 'complete',
      data: {
        connectionId,
        finishReason,
        totalChunks: connection.metadata.chunksReceived,
        totalBytes: connection.metadata.bytesReceived,
        duration: Date.now() - connection.metadata.connectedAt.getTime()
      },
      timestamp: new Date(),
      eventId: randomBytes(8).toString('hex')
    });

    // Nettoyage après un délai
    setTimeout(() => {
      this.closeConnection(connectionId);
    }, 5000); // 5 secondes

    this.emit('stream_completed', { connectionId, finishReason });
  }

  private async handleStreamError(connectionId: string, error: Error): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = 'error';
    connection.updatedAt = new Date();

    await this.updateConnection(connection);

    // Envoi de l'événement d'erreur
    await this.sendEvent(connectionId, {
      type: 'error',
      data: {
        connectionId,
        error: error.message,
        code: error.name,
        timestamp: new Date()
      },
      timestamp: new Date(),
      eventId: randomBytes(8).toString('hex')
    });

    this.emit('stream_error', { connectionId, error });
  }

  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = 'disconnected';
    connection.updatedAt = new Date();

    await this.updateConnection(connection);
    await this.flushBuffer(connectionId);

    // Nettoyage
    this.connections.delete(connectionId);
    this.buffers.delete(connectionId);
    this.connectionCount--;

    this.emit('connection_closed', { connectionId });
  }

  async getConnection(connectionId: string): Promise<StreamConnection | null> {
    const connection = this.connections.get(connectionId);
    if (connection) return connection;

    // Recherche en base si pas en mémoire
    const result = await this.db.query(
      'SELECT * FROM stream_connections WHERE id = $1',
      [connectionId]
    );

    return result.rows[0] || null;
  }

  async getMetrics(connectionId: string, period: { start: Date; end: Date }): Promise<StreamMetrics> {
    // Calcul des métriques pour la période
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // Récupération des chunks depuis la base
    const chunksResult = await this.db.query(`
      SELECT 
        COUNT(*) as total_chunks,
        COALESCE(SUM(size), 0) as total_bytes,
        AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)))) * 1000 as avg_latency,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) * 1000) as p95_latency,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp))) * 1000) as p99_latency
      FROM stream_chunks
      WHERE connection_id = $1 
        AND timestamp BETWEEN $2 AND $3
    `, [connectionId, period.start, period.end]);

    const stats = chunksResult.rows[0];

    return {
      connectionId,
      period,
      performance: {
        totalChunks: parseInt(stats.total_chunks),
        totalBytes: parseInt(stats.total_bytes),
        averageChunkSize: stats.total_chunks > 0 ? parseInt(stats.total_bytes) / parseInt(stats.total_chunks) : 0,
        chunksPerSecond: this.calculateChunksPerSecond(connectionId, period),
        bytesPerSecond: this.calculateBytesPerSecond(connectionId, period),
        latency: {
          min: 0, // Calculé séparément
          max: 0, // Calculé séparément
          average: parseFloat(stats.avg_latency) || 0,
          p95: parseFloat(stats.p95_latency) || 0,
          p99: parseFloat(stats.p99_latency) || 0
        }
      },
      quality: {
        errorRate: await this.calculateErrorRate(connectionId, period),
        reconnectionRate: await this.calculateReconnectionRate(connectionId, period),
        completionRate: await this.calculateCompletionRate(connectionId, period),
        averageStreamDuration: await this.calculateAverageDuration(connectionId, period)
      },
      network: {
        packetsLost: 0, // Calculé via monitoring réseau
        retransmissions: 0,
        connectionDrops: await this.calculateConnectionDrops(connectionId, period),
        averageRTT: connection.metadata.averageLatency
      }
    };
  }

  private async cleanupExpiredConnections(): Promise<void> {
    const now = Date.now();
    const expiredConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const inactiveTime = now - connection.metadata.lastActivity.getTime();
      
      if (inactiveTime > this.config.connectionTimeout) {
        expiredConnections.push(connectionId);
      }
    }

    for (const connectionId of expiredConnections) {
      await this.closeConnection(connectionId);
    }
  }

  private async sendHeartbeats(): Promise<void> {
    for (const [connectionId, connection] of this.connections) {
      if (connection.status === 'streaming') {
        await this.sendEvent(connectionId, {
          type: 'heartbeat',
          data: {
            connectionId,
            timestamp: new Date(),
            chunksReceived: connection.metadata.chunksReceived,
            bytesReceived: connection.metadata.bytesReceived
          },
          timestamp: new Date(),
          eventId: randomBytes(8).toString('hex')
        });
      }
    }
  }

  private async aggregateMetrics(): Promise<void> {
    // Agrégation des métriques pour monitoring
    const totalConnections = this.connections.size;
    const streamingConnections = Array.from(this.connections.values())
      .filter(c => c.status === 'streaming').length;

    const metrics = {
      totalConnections,
      streamingConnections,
      averageLatency: this.calculateAverageLatency(),
      errorRate: this.calculateGlobalErrorRate(),
      bytesTransferred: this.calculateTotalBytes()
    };

    this.emit('metrics_updated', metrics);

    // Sauvegarde en Redis pour monitoring
    await this.redis.setex('streaming_metrics', 300, JSON.stringify(metrics));
  }

  // Méthodes utilitaires
  private calculateChunksPerSecond(connectionId: string, period: { start: Date; end: Date }): number {
    const duration = (period.end.getTime() - period.start.getTime()) / 1000;
    const connection = this.connections.get(connectionId);
    return connection ? connection.metadata.chunksReceived / duration : 0;
  }

  private calculateBytesPerSecond(connectionId: string, period: { start: Date; end: Date }): number {
    const duration = (period.end.getTime() - period.start.getTime()) / 1000;
    const connection = this.connections.get(connectionId);
    return connection ? connection.metadata.bytesReceived / duration : 0;
  }

  private async calculateErrorRate(connectionId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul du taux d'erreur
    return 0;
  }

  private async calculateReconnectionRate(connectionId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul du taux de reconnexion
    return 0;
  }

  private async calculateCompletionRate(connectionId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul du taux de completion
    return 0;
  }

  private async calculateAverageDuration(connectionId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul de la durée moyenne
    return 0;
  }

  private async calculateConnectionDrops(connectionId: string, period: { start: Date; end: Date }): Promise<number> {
    // Implémentation du calcul des drops de connexion
    return 0;
  }

  private calculateAverageLatency(): number {
    const connections = Array.from(this.connections.values());
    if (connections.length === 0) return 0;
    
    const totalLatency = connections.reduce((sum, c) => sum + c.metadata.averageLatency, 0);
    return totalLatency / connections.length;
  }

  private calculateGlobalErrorRate(): number {
    // Implémentation du calcul du taux d'erreur global
    return 0;
  }

  private calculateTotalBytes(): number {
    return Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.metadata.bytesReceived, 0);
  }

  // Méthodes de persistance
  private async saveConnection(connection: StreamConnection): Promise<void> {
    await this.db.query(`
      INSERT INTO stream_connections (
        id, client_id, user_id, session_id, request_id, status,
        provider, model, metadata, options, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `, [
      connection.id,
      connection.clientId,
      connection.userId,
      connection.sessionId,
      connection.requestId,
      connection.status,
      connection.provider,
      connection.model,
      JSON.stringify(connection.metadata),
      JSON.stringify(connection.options),
      connection.createdAt,
      connection.updatedAt
    ]);
  }

  private async updateConnection(connection: StreamConnection): Promise<void> {
    await this.db.query(`
      UPDATE stream_connections 
      SET status = $1, metadata = $2, updated_at = $3
      WHERE id = $4
    `, [
      connection.status,
      JSON.stringify(connection.metadata),
      connection.updatedAt,
      connection.id
    ]);
  }

  private async saveBuffer(buffer: StreamBuffer): Promise<void> {
    await this.db.query(`
      INSERT INTO stream_buffers (
        connection_id, chunks, max_size, flush_threshold, 
        last_flush, compression_enabled
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT (connection_id) DO UPDATE SET
        chunks = EXCLUDED.chunks,
        last_flush = EXCLUDED.last_flush
    `, [
      buffer.connectionId,
      JSON.stringify(buffer.chunks),
      buffer.maxSize,
      buffer.flushThreshold,
      buffer.lastFlush,
      buffer.compressionEnabled
    ]);
  }

  private async updateBuffer(buffer: StreamBuffer): Promise<void> {
    await this.db.query(`
      UPDATE stream_buffers 
      SET chunks = $1, last_flush = $2
      WHERE connection_id = $3
    `, [
      JSON.stringify(buffer.chunks),
      buffer.lastFlush,
      buffer.connectionId
    ]);
  }

  private async saveChunks(chunks: StreamChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const values = chunks.map(chunk => [
      chunk.id,
      chunk.connectionId,
      chunk.sequence,
      chunk.type,
      JSON.stringify(chunk.data),
      chunk.timestamp,
      chunk.size,
      chunk.checksum
    ]);

    await this.db.query(`
      INSERT INTO stream_chunks (
        id, connection_id, sequence, type, data, timestamp, size, checksum
      ) VALUES ${values.map((_, i) => 
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
      ).join(', ')}
    `, values.flat());
  }
}
