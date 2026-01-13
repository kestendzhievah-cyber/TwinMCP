import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { LoggingContext } from '../types/gateway.types';

export class LoggingMiddleware {
  static requestTracker() {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      // Générer un ID unique pour la requête
      const requestId = uuidv4();
      
      // Ajouter le contexte de logging à la requête
      (request as any).loggingContext = {
        requestId,
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: this.extractUserId(request),
        apiKey: this.extractApiKey(request)
      };
      
      // Logger le début de la requête et mesurer le temps de réponse
      const startTime = Date.now();
      (request as any).replyStartTime = startTime;
      request.log.info('Request started', (request as any).loggingContext);
    };
  }

  static errorLogger() {
    return async (error: Error, request: FastifyRequest, _reply: FastifyReply) => {
      request.log.error('Request error', {
        ...(request as any).loggingContext,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        statusCode: _reply.statusCode
      });
    };
  }

  private static extractUserId(request: FastifyRequest): string | undefined {
    // Extraire depuis JWT token ou autre méthode d'auth
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Pour l'instant, placeholder
      return 'user-placeholder';
    }
    return undefined;
  }

  private static extractApiKey(request: FastifyRequest): string | undefined {
    // Extraire depuis header X-API-Key
    return request.headers['x-api-key'] as string;
  }
}

// Étendre les types Fastify
declare module 'fastify' {
  interface FastifyRequest {
    loggingContext?: LoggingContext;
  }
}
