import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: 'error',
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
  } catch (error) {
    checks.redis = {
      status: 'warning',
      latencyMs: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const dbHealthy = checks.database.status === 'ok';

  return NextResponse.json(
    {
      status: dbHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: dbHealthy ? 200 : 503 }
  );
}
