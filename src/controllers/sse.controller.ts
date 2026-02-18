import { FastifyRequest, FastifyReply } from 'fastify';
import { StreamingService } from '../services/streaming.service';
import { StreamRequest } from '../types/streaming.types';
import { SSE_HEADERS } from '../config/streaming.config';
import { randomUUID } from 'crypto';

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
      const eventHandler = ({ connectionId, event }: { connectionId: string; event: string }) => {
        if (connectionId === connection.id) {
          try {
            reply.raw.write(event);
          } catch (error) {
            console.error('Error writing to SSE stream:', error);
            this.streamingService.closeConnection(connectionId);
          }
        }
      };

      this.streamingService.on('stream_event', eventHandler);

      // Démarrage du stream
      await this.streamingService.startStream(connection.id, streamRequest);

      // Gestion de la déconnexion
      const cleanup = () => {
        this.streamingService.off('stream_event', eventHandler);
        this.streamingService.closeConnection(connection.id);
      };

      request.raw.on('close', cleanup);
      request.raw.on('timeout', cleanup);
      request.raw.on('error', cleanup);

      // Timeout de connexion automatique
      const timeout = setTimeout(() => {
        cleanup();
      }, 300000); // 5 minutes

      request.raw.on('close', () => {
        clearTimeout(timeout);
      });

    } catch (error) {
      console.error('Stream setup error:', error);
      reply.code(500).send({
        success: false,
        error: (error as Error).message
      });
    }
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
        error: (error as Error).message
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
        error: (error as Error).message
      });
    }
  }

  async closeConnection(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { connectionId } = request.params as { connectionId: string };
      
      await this.streamingService.closeConnection(connectionId);
      
      reply.send({
        success: true,
        message: `Connection ${connectionId} closed successfully`
      });

    } catch (error) {
      reply.code(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  }

  async getSystemStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.getSystemStatistics();
      
      reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      reply.code(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private parseStreamRequest(request: FastifyRequest): StreamRequest {
    const body = request.body as any;
    const query = request.query as any;
    
    return {
      id: query.requestId || randomUUID(),
      clientId: query.clientId || request.headers['x-client-id'] as string || 'anonymous',
      provider: body.provider || query.provider || 'openai',
      model: body.model || query.model || 'gpt-4o-mini',
      messages: body.messages || [],
      context: body.context,
      options: {
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        stream: true,
        bufferSize: body.bufferSize,
        flushInterval: body.flushInterval
      },
      metadata: {
        userId: (request as any).user?.id,
        sessionId: query.sessionId,
        purpose: body.purpose || 'chat',
        priority: body.priority || 'normal'
      }
    };
  }

  private async getActiveConnectionsList(): Promise<any[]> {
    // Implémentation pour récupérer les connexions actives
    // Pour l'instant, retourne une liste vide
    return [];
  }

  private async getSystemStatistics(): Promise<any> {
    // Implémentation pour récupérer les statistiques système
    return {
      totalConnections: 0,
      activeConnections: 0,
      streamingConnections: 0,
      averageLatency: 0,
      errorRate: 0,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }
}
