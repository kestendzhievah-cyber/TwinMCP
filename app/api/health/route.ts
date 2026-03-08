import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/health
 * Liveness probe — always returns 200 if the process is running.
 * When ?ready=true is passed, performs a readiness check (DB + Redis).
 */
export async function GET(request: NextRequest) {
  const wantReady = request.nextUrl.searchParams.get('ready') === 'true';

  const base = {
    status: 'healthy' as string,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
  };

  if (!wantReady) {
    return NextResponse.json(base, {
      headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=5' },
    });
  }

  // Readiness check — verify database connectivity
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    const { redis } = await import('@/lib/redis');
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error';
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok');

  return NextResponse.json(
    { ...base, status: allOk ? 'healthy' : 'degraded', checks },
    {
      status: allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-cache' },
    }
  );
}
