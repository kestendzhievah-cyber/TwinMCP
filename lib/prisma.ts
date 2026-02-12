import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

// ─── Prisma singleton (preferred DB access) ───
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// ─── pg.Pool singleton (legacy, for services not yet migrated to Prisma) ───
const globalForPool = globalThis as unknown as { pgPool: Pool }

export const pool = globalForPool.pgPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

if (process.env.NODE_ENV !== 'production') globalForPool.pgPool = pool