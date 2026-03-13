/**
 * Unified MCP Server singleton for the Next.js app.
 *
 * Uses the official @modelcontextprotocol/sdk McpServer class.
 * Exposes two tools:
 *   - resolve-library-id  — find a library by name
 *   - query-docs           — search documentation for a library
 *
 * The server instance is created once and reused across all transports
 * (Streamable HTTP POST, SSE, etc.).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createHash } from 'crypto';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy service initialisation (avoids DB connections at import time)
// ---------------------------------------------------------------------------

let libraryResolutionService: any = null;
let vectorSearchService: any = null;
let servicesInitialized = false;

async function ensureServices(): Promise<void> {
  if (servicesInitialized) return;
  servicesInitialized = true;

  try {
    const { prisma } = await import('@/lib/prisma');
    let redisClient: any = null;
    try {
      const { redis } = await import('@/lib/redis');
      redisClient = redis;
    } catch {
      logger.warn('[MCP] Redis unavailable — running without cache');
    }

    try {
      const { LibraryResolutionService } =
        await import('@/lib/services/library-resolution.service');
      libraryResolutionService = new LibraryResolutionService(prisma, redisClient);
    } catch (e) {
      logger.warn('[MCP] LibraryResolutionService not available:', e);
    }

    try {
      const { VectorSearchService } = await import('@/lib/services/vector-search.service');
      vectorSearchService = new VectorSearchService(prisma, redisClient);
    } catch (e) {
      logger.warn('[MCP] VectorSearchService not available:', e);
    }
  } catch (e) {
    logger.error('[MCP] Failed to initialise services:', e);
    // Reset so we can retry on next request
    servicesInitialized = false;
  }
}

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------

export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; userId?: string; plan?: string }> {
  if (!apiKey) return { valid: false };

  try {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const { prisma } = await import('@/lib/prisma');

    // Select only the fields we need — avoid fetching the entire row
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, userId: true, tier: true, isActive: true, revokedAt: true, expiresAt: true },
    });

    if (!key || !key.isActive || key.revokedAt) return { valid: false };

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) return { valid: false };

    // Update last used (fire-and-forget)
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return { valid: true, userId: key.userId, plan: key.tier || 'free' };
  } catch {
    return { valid: false };
  }
}

// ---------------------------------------------------------------------------
// Rate-limit check
// ---------------------------------------------------------------------------

// In-memory rate-limit counters — reset on deploy, but fast O(1) check.
// Redis is preferred when available; this is the fallback.
const _rlCounters = new Map<string, { count: number; resetAt: number }>();
const _RL_WINDOW_MS = 60_000; // 1-minute sliding window for burst protection

export async function checkRateLimit(
  userId: string,
  plan: string
): Promise<{ allowed: boolean; remaining: number }> {
  const dailyLimits: Record<string, number> = {
    free: 200,
    pro: 10000,
    enterprise: 100000,
  };
  const dailyLimit = dailyLimits[plan] || dailyLimits.free;

  // Per-minute burst limits (prevents thundering herd)
  const burstLimits: Record<string, number> = {
    free: 20,
    pro: 200,
    enterprise: 2000,
  };
  const burstLimit = burstLimits[plan] || burstLimits.free;

  // Fast path: in-memory burst check (O(1), no DB)
  const now = Date.now();
  const burstKey = `burst:${userId}`;
  let burst = _rlCounters.get(burstKey);
  if (!burst || burst.resetAt < now) {
    burst = { count: 0, resetAt: now + _RL_WINDOW_MS };
  }
  burst.count++;
  _rlCounters.set(burstKey, burst);

  if (burst.count > burstLimit) {
    return { allowed: false, remaining: 0 };
  }

  // Periodic cleanup to prevent memory leak (every 10k entries)
  if (_rlCounters.size > 10_000) {
    for (const [k, v] of _rlCounters) {
      if (v.resetAt < now) _rlCounters.delete(k);
    }
  }

  // Daily limit: check Redis first, fallback to DB
  try {
    let usage: number;
    try {
      const { redis } = await import('@/lib/redis');
      const dayKey = `mcp:daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
      const cached = await redis.get(dayKey);
      if (cached !== null) {
        usage = parseInt(cached, 10);
      } else {
        const { prisma } = await import('@/lib/prisma');
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        usage = await prisma.usageLog.count({
          where: { userId, createdAt: { gte: dayStart } },
        });
        // Cache for 30s to avoid repeated COUNT queries
        await redis.setex(dayKey, 30, usage.toString());
      }
    } catch {
      // Redis unavailable — fallback to DB
      const { prisma } = await import('@/lib/prisma');
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      usage = await prisma.usageLog.count({
        where: { userId, createdAt: { gte: dayStart } },
      });
    }
    return { allowed: usage < dailyLimit, remaining: Math.max(0, dailyLimit - usage) };
  } catch {
    // Fail open to avoid blocking legitimate requests
    return { allowed: true, remaining: dailyLimit };
  }
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

export function trackUsage(
  userId: string,
  tool: string,
  tokens: number,
  responseTimeMs: number = 0,
  success: boolean = true,
  errorMessage?: string
) {
  // Fire-and-forget — don't block the response on usage tracking
  import('@/lib/prisma')
    .then(({ prisma }) =>
      prisma.usageLog.create({
        data: {
          userId,
          toolName: tool,
          tokensReturned: tokens,
          success,
          responseTimeMs,
          errorMessage: errorMessage || null,
        },
      })
    )
    .then(() => {
      // Bump daily counter in Redis so rate-limit reads are fresh
      import('@/lib/redis')
        .then(({ redis }) => {
          const dayKey = `mcp:daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
          redis.incr(dayKey).catch(() => {});
          redis.expire(dayKey, 86400).catch(() => {});
        })
        .catch(() => {});
    })
    .catch((e) => logger.error('[MCP] Failed to track usage:', e));
}

// ---------------------------------------------------------------------------
// McpServer singleton
// ---------------------------------------------------------------------------

let _server: McpServer | null = null;

export function getMcpServer(): McpServer {
  if (_server) return _server;

  _server = new McpServer(
    {
      name: 'twinmcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
    }
  );

  // ── Tool: resolve-library-id ─────────────────────────────────
  _server.registerTool(
    'resolve-library-id',
    {
      title: 'Resolve Library ID',
      description:
        'Resolve library names and find matching software libraries. Use this to find the TwinMCP library ID for a given library name before querying documentation.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(500)
          .describe('User question or task to help contextualise the search'),
        libraryName: z
          .string()
          .min(1)
          .max(200)
          .describe('Human name of the library (e.g. "React", "Next.js", "MongoDB")'),
      }),
      annotations: {
        title: 'Resolve Library ID',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, libraryName }) => {
      await ensureServices();

      let result: any;
      if (libraryResolutionService) {
        result = await libraryResolutionService.resolveLibrary({
          query: libraryName,
          context: {},
          limit: 5,
          include_aliases: true,
        });
      } else {
        result = {
          results: [],
          totalFound: 0,
          query: libraryName,
          _note:
            'LibraryResolutionService not available. Configure database for full library resolution.',
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ── Tool: query-docs ─────────────────────────────────────────
  _server.registerTool(
    'query-docs',
    {
      title: 'Query Documentation',
      description:
        'Search documentation for a specific library. Returns code snippets, guides, and API references optimised for LLM context.',
      inputSchema: z.object({
        libraryId: z
          .string()
          .min(1)
          .describe(
            'TwinMCP library ID in format /vendor/lib (e.g. /mongodb/docs, /vercel/next.js)'
          ),
        query: z
          .string()
          .min(1)
          .max(1000)
          .describe('Question or task (setup, code example, configuration, etc.)'),
        version: z.string().optional().describe('Optional specific version of the library'),
        maxResults: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe('Maximum number of results (default: 10)'),
        maxTokens: z
          .number()
          .min(100)
          .max(8000)
          .default(4000)
          .describe('Maximum tokens in response (default: 4000)'),
      }),
      annotations: {
        title: 'Query Documentation',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ libraryId, query, version, maxResults, maxTokens }) => {
      await ensureServices();

      let result: any;
      if (vectorSearchService) {
        result = await vectorSearchService.searchDocuments({
          library_id: libraryId,
          query,
          version,
          max_results: maxResults || 10,
          include_code: true,
          context_limit: maxTokens || 4000,
        });
      } else {
        result = {
          libraryId,
          query,
          results: [],
          totalResults: 0,
          totalTokens: 0,
          _note:
            'VectorSearchService not available. Configure database and vector store for full documentation search.',
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  logger.info('[MCP] McpServer singleton created with 2 tools');
  return _server;
}
