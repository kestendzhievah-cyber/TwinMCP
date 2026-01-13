# Story 1.2: Configuration des bases de données

**Epic**: 1 - Infrastructure Core et Foundation  
**Story**: 1.2 - Configuration des bases de données  
**Estimation**: 4-5 jours  
**Priorité**: Critique  

---

## Objectif

Mettre en place PostgreSQL pour les métadonnées et Redis pour le cache, avec schéma complet, migrations Prisma, et connexions optimisées.

---

## Prérequis

- Story 1.1 complétée (environnement TypeScript configuré)
- Docker installé (pour développement local)
- Accès à une instance PostgreSQL (locale ou cloud)
- Accès à une instance Redis (locale ou cloud)

---

## Étapes Détaillées

### Étape 1: Installation des dépendances base de données

**Action**: Installer Prisma, clients PostgreSQL et Redis

```bash
# Installer Prisma et clients
npm install prisma @prisma/client
npm install --save-dev prisma

# Installer Redis client
npm install redis ioredis

# Installer les types
npm install --save-dev @types/redis

# Installer utilitaires de DB
npm install pg @types/pg
```

**Vérification des installations**:
```bash
# Vérifier Prisma CLI
npx prisma --version

# Vérifier les modules installés
npm list | grep -E "(prisma|redis|pg)"
```

### Étape 2: Configuration Docker pour développement

**Action**: Créer docker-compose.yml pour les bases de données locales

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: twinmcp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: twinmcp_dev
      POSTGRES_USER: twinmcp_user
      POSTGRES_PASSWORD: twinmcp_password
      POSTGRES_HOST_AUTH_METHOD: trust
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    networks:
      - twinmcp-network

  redis:
    image: redis:7-alpine
    container_name: twinmcp-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - twinmcp-network

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: twinmcp-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@twinmcp.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - twinmcp-network

volumes:
  postgres_data:
  redis_data:

networks:
  twinmcp-network:
    driver: bridge
```

**Script d'initialisation scripts/init-db.sql**:
```sql
-- Création de la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS twinmcp_dev;

-- Création de l'utilisateur avec permissions
CREATE USER IF NOT EXISTS twinmcp_user WITH PASSWORD 'twinmcp_password';

-- Attribution des permissions
GRANT ALL PRIVILEGES ON DATABASE twinmcp_dev TO twinmcp_user;

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

**Démarrage des services**:
```bash
# Démarrer les conteneurs
docker-compose up -d

# Vérifier l'état
docker-compose ps

# Voir les logs
docker-compose logs postgres
docker-compose logs redis
```

### Étape 3: Configuration Prisma

**Action**: Initialiser Prisma et configurer le schéma

```bash
# Initialiser Prisma
npx prisma init

# Configurer le fichier .env
cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://twinmcp_user:twinmcp_password@localhost:5432/twinmcp_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# Environment
NODE_ENV="development"
PORT=3000
EOF
```

**Configuration prisma/schema.prisma**:
```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Table des utilisateurs
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  hashedPassword String? // Null si OAuth uniquement
  oauthProvider String?  // "github", "google", etc.
  oauthId      String?  // ID externe du provider
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  apiKeys      ApiKey[]
  usageLogs    UsageLog[]

  @@map("users")
}

// Table des clés API
model ApiKey {
  id                    String   @id @default(uuid())
  userId                String
  keyHash               String   @unique
  keyPrefix             String   // Pour affichage partiel
  name                  String
  quotaRequestsPerMinute Int    @default(60)
  quotaRequestsPerDay   Int     @default(10000)
  lastUsedAt            DateTime?
  createdAt             DateTime @default(now())
  revokedAt             DateTime?

  // Relations
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  usageLogs             UsageLog[]

  @@map("api_keys")
}

// Table des bibliothèques
model Library {
  id              String    @id // ex: /mongodb/docs
  name            String
  vendor          String?
  repoUrl         String?
  docsUrl         String?
  defaultVersion  String?
  popularityScore Int       @default(0)
  totalSnippets   Int       @default(0)
  totalTokens     Int       @default(0)
  lastCrawledAt   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  metadata        Json?     // tags, catégories, etc.

  // Relations
  versions        LibraryVersion[]
  chunks          DocumentationChunk[]
  usageLogs       UsageLog[]

  @@index([name] using gin(to_tsvector('english', name)))
  @@index([popularityScore])
  @@index([lastCrawledAt])
  @@map("libraries")
}

// Versions des bibliothèques
model LibraryVersion {
  id              String   @id @default(uuid())
  libraryId       String
  version         String
  releaseDate     DateTime?
  isLatest        Boolean  @default(false)
  docsSnapshotUrl String?  // S3 path

  // Relations
  library         Library @relation(fields: [libraryId], references: [id], onDelete: Cascade)
  chunks          DocumentationChunk[]

  @@unique([libraryId, version])
  @@map("library_versions")
}

// Chunks de documentation
model DocumentationChunk {
  id              String   @id @default(uuid())
  libraryVersionId String
  chunkIndex      Int
  content         String
  contentType     String   // 'snippet', 'guide', 'api_ref'
  sourceUrl       String?
  tokenCount      Int
  embeddingId     String?  // ID dans le vector store
  metadata        Json?    // { section, subsection, code_language, etc. }
  createdAt       DateTime @default(now())

  // Relations
  libraryVersion  LibraryVersion @relation(fields: [libraryVersionId], references: [id], onDelete: Cascade)

  @@index([libraryVersionId])
  @@index([contentType])
  @@map("documentation_chunks")
}

// Logs d'utilisation
model UsageLog {
  id             String   @id @default(uuid())
  userId         String?
  apiKeyId       String?
  toolName       String   // 'resolve-library-id', 'query-docs'
  libraryId      String?
  query          String?
  tokensReturned Int?
  responseTimeMs Int?
  createdAt      DateTime @default(now())

  // Relations
  user           User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  apiKey         ApiKey?  @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@index([apiKeyId, createdAt(sort: Desc)])
  @@index([toolName])
  @@index([createdAt(sort: Desc)])
  @@map("usage_logs")
}

// Tokens OAuth
model OAuthToken {
  id           String   @id @default(uuid())
  userId       String
  provider     String   // "github", "google", etc.
  accessToken  String
  refreshToken String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@unique([userId, provider])
  @@map("oauth_tokens")
}
```

### Étape 4: Génération et migration Prisma

**Action**: Créer les migrations et générer le client Prisma

```bash
# Créer la première migration
npx prisma migrate dev --name init

# Générer le client Prisma
npx prisma generate

# Vérifier que le client est généré
ls -la src/generated/prisma/
```

**Script de migration manuelle (si nécessaire)**:
```bash
# Créer la migration manuellement
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > scripts/init-migration.sql

# Appliquer manuellement si besoin
psql $DATABASE_URL -f scripts/init-migration.sql
```

### Étape 5: Configuration du client PostgreSQL

**Action**: Créer le service de connexion à la base de données

**src/config/database.ts**:
```typescript
import { PrismaClient } from '../generated/prisma';
import { logger } from '../utils/logger';

// Configuration Prisma avec logging
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Logging des requêtes en développement
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Query: ' + e.query);
    logger.debug('Params: ' + e.params);
    logger.debug('Duration: ' + e.duration + 'ms');
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma error:', e);
});

prisma.$on('info', (e) => {
  logger.info('Prisma info:', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

export { prisma };

// Fonction de connexion
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database');
    
    // Test de connexion
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection test successful');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

// Fonction de déconnexion
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from PostgreSQL database');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
}

// Health check
export async function databaseHealthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}
```

**src/utils/logger.ts**:
```typescript
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'twinmcp' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Logger console en développement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
```

### Étape 6: Configuration du client Redis

**Action**: Créer le service Redis pour le cache et les sessions

**src/config/redis.ts**:
```typescript
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Configuration Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
};

// Client principal pour le cache
export const redisClient = new Redis(redisConfig);

// Client pour les sessions (DB séparée)
export const redisSessionClient = new Redis({
  ...redisConfig,
  db: parseInt(process.env.REDIS_SESSION_DB || '1'),
});

// Gestion des événements Redis
redisClient.on('connect', () => {
  logger.info('Connected to Redis (cache)');
});

redisClient.on('error', (error) => {
  logger.error('Redis connection error (cache):', error);
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed (cache)');
});

redisSessionClient.on('connect', () => {
  logger.info('Connected to Redis (sessions)');
});

redisSessionClient.on('error', (error) => {
  logger.error('Redis connection error (sessions):', error);
});

// Fonctions utilitaires
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    await redisSessionClient.connect();
    logger.info('Redis clients connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    await redisSessionClient.quit();
    logger.info('Redis clients disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
    throw error;
  }
}

// Health check
export async function redisHealthCheck(): Promise<boolean> {
  try {
    await redisClient.ping();
    await redisSessionClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

// Utilitaires de cache
export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await redisClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  static async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await redisClient.incr(key);
      if (ttl) {
        await redisClient.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }
}
```

### Étape 7: Services de base de données

**Action**: Créer les services pour les opérations DB courantes

**src/services/database.service.ts**:
```typescript
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

export class DatabaseService {
  // Service Users
  static async createUser(userData: {
    email: string;
    hashedPassword?: string;
    oauthProvider?: string;
    oauthId?: string;
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

  // Service API Keys
  static async createApiKey(keyData: {
    userId: string;
    keyHash: string;
    keyPrefix: string;
    name: string;
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

  // Service Libraries
  static async createLibrary(libraryData: {
    id: string;
    name: string;
    vendor?: string;
    repoUrl?: string;
    docsUrl?: string;
    defaultVersion?: string;
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
          name: {
            search: query,
          },
        },
        orderBy: [
          { popularityScore: 'desc' },
          { name: 'asc' },
        ],
        take: limit,
        select: {
          id: true,
          name: true,
          vendor: true,
          defaultVersion: true,
          popularityScore: true,
          totalSnippets: true,
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
    }
  }
}
```

### Étape 8: Tests des bases de données

**Action**: Créer les tests pour valider les connexions et opérations

**src/test/database.test.ts**:
```typescript
import { prisma, connectDatabase, disconnectDatabase, databaseHealthCheck } from '../config/database';
import { redisClient, connectRedis, disconnectRedis, redisHealthCheck, CacheService } from '../config/redis';
import { DatabaseService } from '../services/database.service';

describe('Database Configuration', () => {
  beforeAll(async () => {
    await connectDatabase();
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await disconnectRedis();
  });

  describe('PostgreSQL Connection', () => {
    it('should connect to PostgreSQL', async () => {
      const isHealthy = await databaseHealthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should execute raw query', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toEqual([{ test: 1 }]);
    });
  });

  describe('Redis Connection', () => {
    it('should connect to Redis', async () => {
      const isHealthy = await redisHealthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should set and get values', async () => {
      await redisClient.set('test:key', 'test:value');
      const value = await redisClient.get('test:key');
      expect(value).toBe('test:value');
      
      await redisClient.del('test:key');
    });
  });

  describe('Cache Service', () => {
    it('should cache and retrieve objects', async () => {
      const testData = { id: 1, name: 'test' };
      
      await CacheService.set('test:object', testData);
      const cached = await CacheService.get('test:object');
      
      expect(cached).toEqual(testData);
      
      await CacheService.del('test:object');
    });

    it('should handle cache misses', async () => {
      const result = await CacheService.get('nonexistent:key');
      expect(result).toBeNull();
    });

    it('should check existence', async () => {
      await CacheService.set('test:exists', true);
      
      const exists = await CacheService.exists('test:exists');
      expect(exists).toBe(true);
      
      const notExists = await CacheService.exists('not:exists');
      expect(notExists).toBe(false);
      
      await CacheService.del('test:exists');
    });
  });

  describe('Database Service', () => {
    it('should create and retrieve user', async () => {
      const userData = {
        email: 'test@example.com',
        hashedPassword: 'hashed_password',
      };

      const user = await DatabaseService.createUser(userData);
      expect(user.email).toBe(userData.email);
      expect(user.id).toBeDefined();

      const retrieved = await DatabaseService.getUserByEmail(userData.email);
      expect(retrieved?.email).toBe(userData.email);
      expect(retrieved?.id).toBe(user.id);
    });

    it('should create API key', async () => {
      const user = await DatabaseService.createUser({
        email: 'apikey@example.com',
      });

      const keyData = {
        userId: user.id,
        keyHash: 'test_hash',
        keyPrefix: 'test_',
        name: 'Test Key',
      };

      const apiKey = await DatabaseService.createApiKey(keyData);
      expect(apiKey.userId).toBe(user.id);
      expect(apiKey.keyPrefix).toBe('test_');
    });

    it('should create and search libraries', async () => {
      const libraryData = {
        id: '/test/library',
        name: 'Test Library',
        vendor: 'Test Vendor',
      };

      const library = await DatabaseService.createLibrary(libraryData);
      expect(library.name).toBe('Test Library');

      const results = await DatabaseService.searchLibraries('Test');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Test Library');
    });

    it('should log usage', async () => {
      const logData = {
        toolName: 'test-tool',
        query: 'test query',
        responseTimeMs: 100,
      };

      const log = await DatabaseService.logUsage(logData);
      expect(log.toolName).toBe('test-tool');
      expect(log.responseTimeMs).toBe(100);
    });
  });
});
```

### Étape 9: Scripts de gestion des bases de données

**Action**: Créer des scripts utilitaires pour la gestion DB

**scripts/db-seed.ts**:
```typescript
import { PrismaClient } from '../src/generated/prisma';
import { DatabaseService } from '../src/services/database.service';

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('Seeding database...');

  try {
    // Créer des bibliothèques de test
    const libraries = [
      {
        id: '/mongodb/docs',
        name: 'MongoDB Documentation',
        vendor: 'MongoDB',
        repoUrl: 'https://github.com/mongodb/docs',
        docsUrl: 'https://docs.mongodb.com',
        defaultVersion: '7.0',
        popularityScore: 100,
      },
      {
        id: '/vercel/next.js',
        name: 'Next.js Documentation',
        vendor: 'Vercel',
        repoUrl: 'https://github.com/vercel/next.js',
        docsUrl: 'https://nextjs.org/docs',
        defaultVersion: '14.0',
        popularityScore: 95,
      },
      {
        id: '/supabase/supabase',
        name: 'Supabase Documentation',
        vendor: 'Supabase',
        repoUrl: 'https://github.com/supabase/supabase',
        docsUrl: 'https://supabase.com/docs',
        defaultVersion: '1.0',
        popularityScore: 80,
      },
    ];

    for (const libData of libraries) {
      await DatabaseService.createLibrary(libData);
      console.log(`Created library: ${libData.name}`);
    }

    // Créer un utilisateur de test
    const user = await DatabaseService.createUser({
      email: 'test@twinmcp.dev',
      hashedPassword: 'hashed_test_password',
    });

    console.log(`Created test user: ${user.email}`);

    // Créer une clé API de test
    await DatabaseService.createApiKey({
      userId: user.id,
      keyHash: 'test_api_key_hash',
      keyPrefix: 'twinmcp_test_',
      name: 'Test API Key',
      quotaRequestsPerMinute: 100,
      quotaRequestsPerDay: 10000,
    });

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

**Scripts package.json**:
```json
{
  "scripts": {
    // Scripts DB
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:reset": "prisma migrate reset",
    "db:seed": "ts-node scripts/db-seed.ts",
    "db:studio": "prisma studio",
    
    // Docker
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    
    // Health checks
    "health:db": "ts-node scripts/health-check.ts",
    "health:redis": "redis-cli ping"
  }
}
```

### Étape 10: Monitoring et health checks

**Action**: Créer les endpoints de health check

**src/health/health.controller.ts**:
```typescript
import { Request, Response } from 'express';
import { databaseHealthCheck } from '../config/database';
import { redisHealthCheck } from '../config/redis';

export class HealthController {
  static async check(req: Request, res: Response) {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: await databaseHealthCheck(),
        redis: await redisHealthCheck(),
      },
    };

    const allHealthy = Object.values(health.services).every(Boolean);
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json(health);
  }

  static async readiness(req: Request, res: Response) {
    // Check readiness for Kubernetes
    const isReady = await databaseHealthCheck() && await redisHealthCheck();
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
    });
  }

  static async liveness(req: Request, res: Response) {
    // Simple liveness probe
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Critères d'Achèvement

- [ ] PostgreSQL accessible et fonctionnel
- [ ] Redis accessible et fonctionnel  
- [ ] Schéma Prisma créé et migré
- [ ] Client Prisma généré et fonctionnel
- [ ] Services de base de données opérationnels
- [ ] Cache Redis fonctionnel
- [ ] Tests de base de données passants
- [ ] Scripts de seed et gestion créés
- [ ] Health checks implémentés

---

## Tests de Validation

```bash
# 1. Démarrer les services
npm run docker:up

# 2. Appliquer les migrations
npm run db:migrate

# 3. Générer le client Prisma
npm run db:generate

# 4. Seeding des données
npm run db:seed

# 5. Exécuter les tests
npm test -- --testPathPattern=database

# 6. Vérifier Prisma Studio
npm run db:studio

# 7. Health checks
curl http://localhost:3000/health
```

---

## Risques et Mitigations

**Risque**: Connexion PostgreSQL échoue  
**Mitigation**: Vérifier les credentials et configurer SSL si nécessaire

**Risque**: Redis non disponible  
**Mitigation**: Implémenter fallback et retry logic

**Risque**: Migration Prisma échoue  
**Mitigation**: Backup des données et rollback strategy

---

## Prochaine Étape

Passer à **Story 1.3: Configuration de l'infrastructure de vector store** pour mettre en place Pinecone/Qdrant.
