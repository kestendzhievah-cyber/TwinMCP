import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// ─── Prisma singleton (preferred DB access) ───
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Log slow queries in development
    log:
      process.env.NODE_ENV !== 'production'
        ? [
            { emit: 'stdout', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
    // Datasource URL can include connection pool params:
    //   ?connection_limit=10&pool_timeout=20
    // These are set via DATABASE_URL env var.
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── pg.Pool singleton (legacy, for services not yet migrated to Prisma) ───
const globalForPool = globalThis as unknown as { pgPool: Pool };

export const pool =
  globalForPool.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
            ca: process.env.DATABASE_SSL_CA || undefined,
          }
        : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') globalForPool.pgPool = pool;
