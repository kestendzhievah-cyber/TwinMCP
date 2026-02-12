import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

export class DatabaseService {
  // Service Users
  static async createUser(userData: {
    email: string;
    name?: string;
    hashedPassword?: string;
    oauthProvider?: string;
    oauthId?: string;
    clientId: string;
  }) {
    try {
      const user = await prisma.user.create({
        data: userData,
      });
      
      logger.info('User created:', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  static async getUserByEmail(email: string) {
    try {
      // Essayer le cache d'abord
      const cacheKey = `user:email:${email}`;
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          apiKeys: {
            where: { revokedAt: null },
          },
        },
      });

      // Mettre en cache pour 5 minutes
      if (user) {
        await CacheService.set(cacheKey, user, 300);
      }

      return user;
    } catch (error) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }

  static async getUserById(id: string) {
    try {
      const cacheKey = `user:id:${id}`;
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          apiKeys: {
            where: { revokedAt: null },
          },
        },
      });

      if (user) {
        await CacheService.set(cacheKey, user, 300);
      }

      return user;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  // Service API Keys
  static async createApiKey(keyData: {
    userId: string;
    keyHash: string;
    keyPrefix: string;
    name?: string;
    quotaRequestsPerMinute?: number;
    quotaRequestsPerDay?: number;
  }) {
    try {
      const apiKey = await prisma.apiKey.create({
        data: keyData,
      });

      logger.info('API key created:', { 
        apiKeyId: apiKey.id, 
        userId: apiKey.userId,
        keyPrefix: apiKey.keyPrefix 
      });

      return apiKey;
    } catch (error) {
      logger.error('Error creating API key:', error);
      throw error;
    }
  }

  static async getApiKeyByHash(keyHash: string) {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return apiKey;
    } catch (error) {
      logger.error('Error getting API key by hash:', error);
      throw error;
    }
  }

  static async updateApiKeyLastUsed(keyId: string) {
    try {
      await prisma.apiKey.update({
        where: { id: keyId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      logger.error('Error updating API key last used:', error);
    }
  }

  // Service Libraries
  static async createLibrary(libraryData: {
    id: string;
    name: string;
    displayName: string;
    vendor?: string;
    repoUrl?: string;
    docsUrl?: string;
    defaultVersion?: string;
    language: string;
    ecosystem: string;
    clientId: string;
    metadata?: any;
  }) {
    try {
      const library = await prisma.library.create({
        data: libraryData,
      });

      logger.info('Library created:', { 
        libraryId: library.id, 
        name: library.name 
      });

      return library;
    } catch (error) {
      logger.error('Error creating library:', error);
      throw error;
    }
  }

  static async searchLibraries(query: string, limit: number = 10) {
    try {
      const cacheKey = `libraries:search:${query}:${limit}`;
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const libraries = await prisma.library.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { vendor: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: [
          { popularityScore: 'desc' },
          { name: 'asc' },
        ],
        take: limit,
        select: {
          id: true,
          name: true,
          displayName: true,
          vendor: true,
          defaultVersion: true,
          popularityScore: true,
          totalSnippets: true,
          language: true,
          ecosystem: true,
        },
      });

      // Mettre en cache pour 15 minutes
      await CacheService.set(cacheKey, libraries, 900);

      return libraries;
    } catch (error) {
      logger.error('Error searching libraries:', error);
      throw error;
    }
  }

  static async getLibraryById(id: string) {
    try {
      const cacheKey = `library:id:${id}`;
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const library = await prisma.library.findUnique({
        where: { id },
        include: {
          versions: {
            where: { isLatest: true },
          },
          aliases: true,
        },
      });

      if (library) {
        await CacheService.set(cacheKey, library, 600);
      }

      return library;
    } catch (error) {
      logger.error('Error getting library by ID:', error);
      throw error;
    }
  }

  // Service Usage Logs
  static async logUsage(logData: {
    userId?: string;
    apiKeyId?: string;
    toolName: string;
    libraryId?: string;
    query?: string;
    tokensReturned?: number;
    responseTimeMs?: number;
  }) {
    try {
      const log = await prisma.usageLog.create({
        data: logData,
      });

      logger.debug('Usage logged:', { 
        logId: log.id, 
        toolName: log.toolName,
        userId: log.userId 
      });

      return log;
    } catch (error) {
      logger.error('Error logging usage:', error);
      // Ne pas throw d'erreur pour ne pas bloquer les requêtes
      return undefined;
    }
  }

  // Service OAuth Tokens
  static async createOAuthToken(tokenData: {
    userId: string;
    provider: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }) {
    try {
      const token = await prisma.oAuthToken.create({
        data: tokenData,
      });

      logger.info('OAuth token created:', { 
        tokenId: token.id, 
        userId: token.userId,
        provider: token.provider 
      });

      return token;
    } catch (error) {
      logger.error('Error creating OAuth token:', error);
      throw error;
    }
  }

  static async getOAuthToken(userId: string, provider: string) {
    try {
      const token = await prisma.oAuthToken.findUnique({
        where: { 
          userId_provider: {
            userId,
            provider,
          },
        },
      });

      return token;
    } catch (error) {
      logger.error('Error getting OAuth token:', error);
      throw error;
    }
  }

  // Service Clients
  static async createClient(clientData: {
    name: string;
    domain?: string;
    apiKeys?: any;
    settings?: any;
  }) {
    try {
      const client = await prisma.client.create({
        data: clientData as any,
      });

      logger.info('Client created:', { 
        clientId: client.id, 
        name: client.name 
      });

      return client;
    } catch (error) {
      logger.error('Error creating client:', error);
      throw error;
    }
  }

  static async getClientById(id: string) {
    try {
      const cacheKey = `client:id:${id}`;
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      });

      if (client) {
        await CacheService.set(cacheKey, client, 600);
      }

      return client;
    } catch (error) {
      logger.error('Error getting client by ID:', error);
      throw error;
    }
  }
}
