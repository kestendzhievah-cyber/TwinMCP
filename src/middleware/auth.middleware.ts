import { logger } from '../utils/logger';
import { FastifyRequest, FastifyReply } from 'fastify';
import { verify, JwtPayload } from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is not configured or too short (min 32 chars)');
  }
  return secret;
}

function verifyToken(token: string): { id: string; email?: string } {
  const secret = getJwtSecret();
  const decoded = verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;

  const userId = decoded.sub || decoded.userId || decoded.id;
  if (!userId || typeof userId !== 'string') {
    throw new Error('Token missing subject (sub) claim');
  }

  return { id: userId, email: decoded.email };
}

export const authMiddleware = {
  required: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          success: false,
          error: 'Authorization header required'
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid token'
        });
      }

      const user = verifyToken(token);
      (request as any).user = user;

    } catch (error) {
      logger.warn('Auth middleware rejection:', error instanceof Error ? error.message : 'Unknown error');
      return reply.code(401).send({
        success: false,
        error: 'Authentication failed'
      });
    }
  },

  optional: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token) {
          const user = verifyToken(token);
          (request as any).user = user;
        }
      }
    } catch (error) {
      // L'authentification optionnelle ne doit pas bloquer la requête
      logger.warn('Optional auth failed (non-blocking):', error instanceof Error ? error.message : 'Unknown error');
    }
  }
};
