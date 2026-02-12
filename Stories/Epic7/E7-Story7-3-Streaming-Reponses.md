# E7-Story7-3-Streaming-Reponses.md

## Epic 7: LLM Integration

### Story 7.3: Streaming des réponses

**Description**: Réponses en temps réel avec Server-Sent Events

---

## Objectif

Développer un système de streaming complet pour les réponses LLM avec Server-Sent Events (SSE), gestion des connexions, buffering intelligent, reconnexion automatique et monitoring des performances.

---

## Prérequis

- Service d'intégration LLM (Story 7.1) avec support streaming
- API Gateway (Epic 3) configurée pour SSE
- Service de prompts (Story 7.2) opérationnel
- Infrastructure de monitoring et logging

---

## Spécifications Techniques

### 1. Architecture de Streaming

#### 1.1 Types et Interfaces

```typescript
// src/types/streaming.types.ts
export interface StreamConnection {
  id: string;
  clientId: string;
  userId?: string;
  sessionId?: string;
  requestId: string;
  status: 'connecting' | 'connected' | 'streaming' | 'completed' | 'error' | 'disconnected';
  provider: string;
  model: string;
  metadata: {
    userAgent: string;
    ip: string;
    connectedAt: Date;
    lastActivity: Date;
    bytesReceived: number;
    chunksReceived: number;
    averageLatency: number;
  };
  options: {
    bufferSize: number;
    flushInterval: number;
    compression: boolean;
    encryption: boolean;
    heartbeatInterval: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamChunk {
  id: string;
  connectionId: string;
  sequence: number;
  type: 'content' | 'metadata' | 'error' | 'control' | 'heartbeat';
  data: any;
  timestamp: Date;
  size: number;
  checksum?: string;
}

export interface StreamEvent {
  type: 'start' | 'chunk' | 'metadata' | 'error' | 'complete' | 'heartbeat' | 'reconnect';
  data: any;
  timestamp: Date;
  eventId: string;
}

export interface StreamBuffer {
  connectionId: string;
  chunks: StreamChunk[];
  maxSize: number;
  flushThreshold: number;
  lastFlush: Date;
  compressionEnabled: boolean;
}

export interface StreamMetrics {
  connectionId: string;
  period: {
    start: Date;
    end: Date;
  };
  performance: {
    totalChunks: number;
    totalBytes: number;
    averageChunkSize: number;
    chunksPerSecond: number;
    bytesPerSecond: number;
    latency: {
      min: number;
      max: number;
      average: number;
      p95: number;
      p99: number;
    };
  };
  quality: {
    errorRate: number;
    reconnectionRate: number;
    completionRate: number;
    averageStreamDuration: number;
  };
  network: {
    packetsLost: number;
    retransmissions: number;
    connectionDrops: number;
    averageRTT: number;
  };
}

export interface StreamConfig {
  maxConnections: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  bufferSize: number;
  flushInterval: number;
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'deflate' | 'br';
    level: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm';
    keyRotation: number;
  };
  monitoring: {
    metricsInterval: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    alertThresholds: {
      errorRate: number;
      latency: number;
      connectionDrops: number;
    };
  };
  fallback: {
    enabled: boolean;
    providers: string[];
    retryAttempts: number;
    retryDelay: number;
  };
}

export interface StreamRequest {
  id: string;
  clientId: string;
  provider: string;
  model: string;
  messages: any[];
  context?: any;
  options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    bufferSize?: number;
    flushInterval?: number;
  };
  metadata: {
    userId?: string;
    sessionId?: string;
    purpose: string;
    priority: 'low' | 'normal' | 'high';
  };
}

export interface StreamResponse {
  id: string;
  requestId: string;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  content: string;
  metadata: {
    chunks: number;
    tokens: number;
    latency: number;
    provider: string;
    model: string;
  };
  events: StreamEvent[];
  createdAt: Date;
  completedAt?: Date;
}
```

#### 1.2 Configuration du Streaming

```typescript
// src/config/streaming.config.ts
export const STREAMING_CONFIG: StreamConfig = {
  maxConnections: 10000,
  connectionTimeout: 300000, // 5 minutes
  heartbeatInterval: 30000, // 30 seconds
  bufferSize: 1024 * 8, // 8KB
  flushInterval: 100, // 100ms
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6
  },
  encryption: {
    enabled: false,
    algorithm: 'aes-256-gcm',
    keyRotation: 86400000 // 24 hours
  },
  monitoring: {
    metricsInterval: 60000, // 1 minute
    logLevel: 'info',
    alertThresholds: {
      errorRate: 0.05, // 5%
      latency: 5000, // 5 seconds
      connectionDrops: 100 // per hour
    }
  },
  fallback: {
    enabled: true,
    providers: ['anthropic', 'google'],
    retryAttempts: 3,
    retryDelay: 1000
  }
};

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Cache-Control, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'X-Accel-Buffering': 'no' // Désactiver le buffering nginx
};
```

### 2. Service de Streaming Principal

#### 2.1 Streaming Service

```typescript
// src/services/streaming.service.ts
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
  StreamConfig
} from '../types/streaming.types';
import { LLMService } from './llm.service';
import { CompressionService } from './compression.service';
import { EncryptionService } from './encryption.service';

export class StreamingService extends EventEmitter {
  private connections: Map<string, StreamConnection> = new Map();
  private buffers: Map<string, StreamBuffer> = new Map();
  private metrics: Map<string, StreamMetrics> = new Map();
  private connectionCount: number = 0;

  constructor(
    private db: Pool,
    private redis: Redis,
    private llmService: LLMService,
    private compressionService: CompressionService,
    private encryptionService: EncryptionService,
    private config = STREAMING_CONFIG
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
        metadata: request.metadata,
        createdAt: new Date()
      });

      // Traitement du stream
      await this.processStream(connectionId, stream);

    } catch (error) {
      await this.handleStreamError(connectionId, error);
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
      await this.handleStreamError(connectionId, error);
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
      if (buffer.compressionEnabled) {
        chunksToFlush = await this.compressionService.compressChunks(buffer.chunks);
      }

      // Chiffrement si activé
      if (this.config.encryption.enabled) {
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
```

### 3. Controller SSE

#### 3.1 SSE Controller

```typescript
// src/controllers/sse.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { StreamingService } from '../services/streaming.service';
import { StreamRequest } from '../types/streaming.types';

export class SSEController {
  constructor(private streamingService: StreamingService) {}

  async handleStream(request: FastifyRequest, reply: FastifyReply) {
    const streamRequest = this.parseStreamRequest(request);
    
    try {
      // Création de la connexion
      const connection = await this.streamingService.createConnection(streamRequest);
      
      // Configuration des headers SSE
      reply.raw.writeHead(200, SSE_HEADERS);
      
      // Écoute des événements de streaming
      this.streamingService.on('stream_event', ({ connectionId, event }) => {
        if (connectionId === connection.id) {
          reply.raw.write(event);
        }
      });

      // Démarrage du stream
      await this.streamingService.startStream(connection.id, streamRequest);

      // Gestion de la déconnexion
      request.raw.on('close', async () => {
        await this.streamingService.closeConnection(connection.id);
      });

      // Timeout de connexion
      request.raw.on('timeout', async () => {
        await this.streamingService.closeConnection(connection.id);
      });

    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  }

  private parseStreamRequest(request: FastifyRequest): StreamRequest {
    const body = request.body as any;
    const query = request.query as any;
    
    return {
      id: query.requestId || crypto.randomUUID(),
      clientId: query.clientId || request.headers['x-client-id'] as string,
      provider: body.provider || query.provider,
      model: body.model || query.model,
      messages: body.messages,
      context: body.context,
      options: {
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        stream: true,
        bufferSize: body.bufferSize,
        flushInterval: body.flushInterval
      },
      metadata: {
        userId: request.user?.id,
        sessionId: query.sessionId,
        purpose: body.purpose || 'chat',
        priority: body.priority || 'normal'
      }
    };
  }

  async getConnectionMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { connectionId } = request.params as { connectionId: string };
      const { start, end } = request.query as { start: string; end: string };
      
      const metrics = await this.streamingService.getMetrics(connectionId, {
        start: new Date(start),
        end: new Date(end)
      });

      reply.send({
        success: true,
        data: metrics
      });

    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  }

  async getActiveConnections(request: FastifyRequest, reply: FastifyReply) {
    try {
      const connections = await this.getActiveConnectionsList();
      
      reply.send({
        success: true,
        data: connections
      });

    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  }

  private async getActiveConnectionsList(): Promise<any[]> {
    // Implémentation pour récupérer les connexions actives
    return [];
  }
}
```

---

## Tâches Détaillées

### 1. Service de Streaming
- [ ] Implémenter StreamingService principal
- [ ] Créer la gestion des connexions
- [ ] Ajouter le buffering intelligent
- [ ] Développer le système d'événements

### 2. Controller SSE
- [ ] Implémenter SSEController
- [ ] Configurer les headers SSE
- [ ] Gérer les cycles de vie
- [ ] Ajouter le monitoring

### 3. Performance et Optimisation
- [ ] Implémenter la compression
- [ ] Ajouter le chiffrement
- [ ] Optimiser le buffering
- [ ] Créer les métriques

### 4. Monitoring et Analytics
- [ ] Développer le système de métriques
- [ ] Ajouter les alertes automatiques
- [ ] Implémenter le logging structuré
- [ ] Créer les dashboards

---

## Validation

### Tests de Streaming

```typescript
// __tests__/streaming.service.test.ts
describe('StreamingService', () => {
  let service: StreamingService;

  beforeEach(() => {
    service = new StreamingService(
      mockDb,
      mockRedis,
      mockLLMService,
      mockCompressionService,
      mockEncryptionService
    );
  });

  describe('createConnection', () => {
    it('should create a streaming connection', async () => {
      const request: StreamRequest = {
        id: 'test-request',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      };

      const connection = await service.createConnection(request);

      expect(connection).toBeDefined();
      expect(connection.status).toBe('connecting');
      expect(connection.provider).toBe('openai');
      expect(connection.model).toBe('gpt-3.5-turbo');
    });
  });

  describe('startStream', () => {
    it('should start streaming and handle chunks', async () => {
      const connectionId = 'test-connection';
      
      // Mock du stream LLM
      const mockStream = [
        { content: 'Hello', delta: 'Hello' },
        { content: 'Hello world', delta: ' world' },
        { content: 'Hello world!', delta: '!', finishReason: 'stop' }
      ];

      jest.spyOn(mockLLMService, 'generateStream').mockResolvedValue(
        (async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        })()
      );

      await service.startStream(connectionId, {
        id: 'test-request',
        clientId: 'test-client',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        options: { stream: true },
        metadata: { purpose: 'chat', priority: 'normal' }
      });

      // Vérification des événements émis
      const events = [];
      service.on('stream_event', (event) => events.push(event));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event.type).toBe('start');
    });
  });
});
```

---

## Architecture

### Composants

1. **StreamingService**: Service principal de streaming
2. **SSEController**: Controller pour Server-Sent Events
3. **Connection Manager**: Gestion des connexions
4. **Buffer Manager**: Gestion des buffers
5. **Metrics Collector**: Collecte des métriques

### Flux de Streaming

```
Client Request → Connection → LLM Stream → Chunk Processing → Buffer → SSE Event → Client
```

---

## Performance

### Optimisations

- **Async Processing**: Traitement asynchrone des chunks
- **Smart Buffering**: Buffering adaptatif
- **Compression**: Compression gzip des données
- **Connection Pooling**: Pool de connexions optimisé
- **Event Batching**: Traitement par lot des événements

### Métriques Cibles

- **Connection Setup**: < 100ms
- **First Chunk**: < 500ms
- **Chunk Latency**: < 100ms
- **Throughput**: > 1MB/s
- **Concurrent Connections**: > 10,000

---

## Monitoring

### Métriques

- `stream.connections.total`: Nombre total de connexions
- `stream.connections.active`: Connexions actives
- `stream.chunks.total`: Chunks traités
- `stream.bytes.total**: Octets transférés
- `stream.latency.average`: Latence moyenne
- `stream.errors.rate`: Taux d'erreurs

---

## Livrables

1. **StreamingService**: Service complet
2. **SSEController**: Controller SSE
3. **Buffer Management**: Buffering intelligent
4. **Compression Service**: Compression des données
5. **Monitoring Dashboard**: Métriques en temps réel

---

## Critères de Succès

- [ ] Streaming SSE fonctionnel
- [ ] Latence < 100ms par chunk
- [ ] Support > 1000 connexions concurrentes
- [ ] Compression > 60%
- [ ] Reconnexion automatique
- [ ] Tests avec couverture > 90%

---

## Suivi

### Post-Implémentation

1. **Performance Monitoring**: Surveillance des latences
2. **Connection Analytics**: Analyse des connexions
3. **Error Tracking**: Suivi des erreurs
4. **Capacity Planning**: Planification de la capacité
