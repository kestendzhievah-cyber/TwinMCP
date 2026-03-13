/**
 * MCP Tools Service — Core business logic for the Outils MCP feature.
 * Handles catalog browsing, tool activation/deactivation, config, and usage tracking.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import {
  MCP_TOOLS_CATALOG,
  TOOL_CATEGORIES,
  getToolById,
  searchTools,
  type McpToolDefinition,
  type McpToolCategory,
} from './catalog';
import { requireProPlan, getUserPlanSafe, isProOrAbove } from './require-pro';
import { TwinMCPError } from '@/lib/errors';

// ─── Types ──────────────────────────────────────────────────────

export interface ToolWithStatus extends McpToolDefinition {
  isActivated: boolean;
  activatedAt: string | null;
  config: Record<string, unknown>;
}

export interface CatalogResponse {
  tools: ToolWithStatus[];
  categories: Record<McpToolCategory, { label: string; description: string; emoji: string; count: number }>;
  totalTools: number;
  activatedCount: number;
  userPlan: string;
  isProUser: boolean;
}

export interface ToolActivationResponse {
  toolId: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  activatedAt: string | null;
  message: string;
}

export interface ToolUsageStats {
  toolId: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  lastUsedAt: string | null;
}

// ─── Service ────────────────────────────────────────────────────

class McpToolsService {
  /**
   * Get the full catalog with user activation status.
   * Available to all users (free users see catalog but can't activate).
   */
  async getCatalog(userId: string, query?: string, category?: McpToolCategory): Promise<CatalogResponse> {
    const userPlan = await getUserPlanSafe(userId);
    const isPro = isProOrAbove(userPlan);

    // Get user's activations (never select config here — API keys must not reach the frontend)
    const activations = await prisma.mcpToolActivation.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { toolId: true, activatedAt: true },
    });

    const activationMap = new Map<string, { activatedAt: Date }>(
      activations.map((a: { toolId: string; activatedAt: Date }) => [
        a.toolId,
        { activatedAt: a.activatedAt },
      ])
    );

    // Filter catalog
    let tools = query ? searchTools(query) : [...MCP_TOOLS_CATALOG];
    if (category) {
      tools = tools.filter(t => t.category === category);
    }

    // Merge with activation status (config is intentionally omitted from catalog listings)
    const toolsWithStatus: ToolWithStatus[] = tools.map(tool => {
      const activation = activationMap.get(tool.id);
      return {
        ...tool,
        isActivated: !!activation,
        activatedAt: activation?.activatedAt?.toISOString() ?? null,
        config: {},
      };
    });

    // Build category counts
    const categoryCounts = Object.entries(TOOL_CATEGORIES).reduce(
      (acc, [key, meta]) => {
        const cat = key as McpToolCategory;
        const count = MCP_TOOLS_CATALOG.filter(t => t.category === cat).length;
        acc[cat] = { ...meta, count };
        return acc;
      },
      {} as CatalogResponse['categories']
    );

    return {
      tools: toolsWithStatus,
      categories: categoryCounts,
      totalTools: MCP_TOOLS_CATALOG.length,
      activatedCount: activations.length,
      userPlan,
      isProUser: isPro,
    };
  }

  /**
   * Activate an MCP tool for a Pro user.
   */
  async activateTool(
    userId: string,
    toolId: string,
    config?: Record<string, unknown>
  ): Promise<ToolActivationResponse> {
    // Gate: Pro plan required
    await requireProPlan(userId);

    const tool = getToolById(toolId);
    if (!tool) {
      throw new ToolNotFoundError(toolId);
    }

    // Validate config: if tool requires an API key, it must be provided
    if (tool.requiresApiKey && tool.envKeyName) {
      const apiKey = config?.[tool.envKeyName] || config?.apiKey;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new ToolConfigError(
          tool.name,
          `La clé API (${tool.envKeyName}) est requise pour activer ${tool.name}.`
        );
      }
    }

    // Upsert activation
    const activation = await prisma.mcpToolActivation.upsert({
      where: { userId_toolId: { userId, toolId } },
      create: {
        userId,
        toolId,
        status: 'ACTIVE',
        config: this.sanitizeConfig(config) as Prisma.InputJsonValue,
      },
      update: {
        status: 'ACTIVE',
        config: this.sanitizeConfig(config) as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Log usage
    await this.logUsage(userId, toolId, 'activate', true);

    logger.info(`[mcp-tools] Tool activated: ${toolId} by user ${userId}`);

    return {
      toolId,
      name: tool.name,
      status: 'ACTIVE',
      activatedAt: activation.activatedAt.toISOString(),
      message: `${tool.name} a été activé avec succès.`,
    };
  }

  /**
   * Deactivate an MCP tool.
   */
  async deactivateTool(userId: string, toolId: string): Promise<ToolActivationResponse> {
    await requireProPlan(userId);

    const tool = getToolById(toolId);
    if (!tool) {
      throw new ToolNotFoundError(toolId);
    }

    const existing = await prisma.mcpToolActivation.findUnique({
      where: { userId_toolId: { userId, toolId } },
    });

    if (!existing) {
      throw new ToolNotActivatedError(toolId);
    }

    await prisma.mcpToolActivation.update({
      where: { userId_toolId: { userId, toolId } },
      data: { status: 'INACTIVE' },
    });

    await this.logUsage(userId, toolId, 'deactivate', true);

    logger.info(`[mcp-tools] Tool deactivated: ${toolId} by user ${userId}`);

    return {
      toolId,
      name: tool.name,
      status: 'INACTIVE',
      activatedAt: null,
      message: `${tool.name} a été désactivé.`,
    };
  }

  /**
   * Get a single tool's details with activation status.
   */
  async getToolDetails(userId: string, toolId: string): Promise<ToolWithStatus> {
    const tool = getToolById(toolId);
    if (!tool) {
      throw new ToolNotFoundError(toolId);
    }

    const activation = await prisma.mcpToolActivation.findUnique({
      where: { userId_toolId: { userId, toolId } },
      select: { activatedAt: true, config: true, status: true },
    });

    // Redact config: only return key names, never values (API keys must stay server-side)
    const rawConfig = (activation?.config as Record<string, unknown>) ?? {};
    const redactedConfig: Record<string, unknown> = {};
    for (const key of Object.keys(rawConfig)) {
      redactedConfig[key] = '••••••••';
    }

    return {
      ...tool,
      isActivated: activation?.status === 'ACTIVE',
      activatedAt: activation?.activatedAt?.toISOString() ?? null,
      config: redactedConfig,
    };
  }

  /**
   * Get usage stats for a user's tools.
   */
  async getUsageStats(userId: string, days: number = 30): Promise<ToolUsageStats[]> {
    await requireProPlan(userId);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const whereCondition = { userId, createdAt: { gte: since } };

    // DB-level aggregation instead of fetching 5000 rows into memory
    const [countsByTool, latencyByTool, lastUsedByTool] = await Promise.all([
      prisma.mcpToolUsageLog.groupBy({
        by: ['toolId', 'success'],
        where: whereCondition,
        _count: true,
      }),
      prisma.mcpToolUsageLog.groupBy({
        by: ['toolId'],
        where: whereCondition,
        _avg: { latencyMs: true },
      }),
      prisma.mcpToolUsageLog.groupBy({
        by: ['toolId'],
        where: whereCondition,
        _max: { createdAt: true },
      }),
    ]);

    // Build stats map from groupBy results
    const statsMap = new Map<string, {
      total: number; success: number; errors: number;
      avgLatencyMs: number; lastUsedAt: Date | null;
    }>();

    for (const row of countsByTool) {
      const existing = statsMap.get(row.toolId) ?? {
        total: 0, success: 0, errors: 0, avgLatencyMs: 0, lastUsedAt: null,
      };
      existing.total += row._count;
      if (row.success) existing.success += row._count;
      else existing.errors += row._count;
      statsMap.set(row.toolId, existing);
    }

    for (const row of latencyByTool) {
      const existing = statsMap.get(row.toolId);
      if (existing) existing.avgLatencyMs = Math.round(row._avg.latencyMs ?? 0);
    }

    for (const row of lastUsedByTool) {
      const existing = statsMap.get(row.toolId);
      if (existing) existing.lastUsedAt = row._max.createdAt;
    }

    return Array.from(statsMap.entries()).map(([toolId, s]) => ({
      toolId,
      totalRequests: s.total,
      successCount: s.success,
      errorCount: s.errors,
      avgLatencyMs: s.avgLatencyMs,
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Get activated tools for a user (used by other services to check what's enabled).
   */
  async getActivatedTools(userId: string): Promise<string[]> {
    const activations = await prisma.mcpToolActivation.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { toolId: true },
    });
    return activations.map((a: { toolId: string }) => a.toolId);
  }

  // ─── Internal helpers ───────────────────────────────────────

  private sanitizeConfig(config?: Record<string, unknown>): Record<string, unknown> {
    if (!config || typeof config !== 'object') return {};

    // Only keep string, number, boolean values — prevent prototype pollution
    const safe: Record<string, unknown> = {};
    const ALLOWED_KEYS = 100;
    let count = 0;

    for (const [key, value] of Object.entries(config)) {
      if (count >= ALLOWED_KEYS) break;
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        // Cap string values at 2000 chars (API keys, connection strings)
        safe[key] = type === 'string' ? (value as string).slice(0, 2000) : value;
        count++;
      }
    }

    return safe;
  }

  async logUsage(
    userId: string,
    toolId: string,
    action: string,
    success: boolean,
    latencyMs?: number,
    error?: string
  ): Promise<void> {
    try {
      await prisma.mcpToolUsageLog.create({
        data: { userId, toolId, action, success, latencyMs, error },
      });
    } catch (e) {
      logger.error(`[mcp-tools] Failed to log usage for tool=${toolId} user=${userId}:`, e);
    }
  }
}

// ─── Custom Errors ──────────────────────────────────────────────

export class ToolNotFoundError extends TwinMCPError {
  constructor(toolId: string) {
    super('TOOL_NOT_FOUND', `Outil MCP introuvable : ${toolId}`, 404);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolNotActivatedError extends TwinMCPError {
  constructor(toolId: string) {
    super('TOOL_NOT_ACTIVATED', `L'outil ${toolId} n'est pas activé.`, 400);
    this.name = 'ToolNotActivatedError';
  }
}

export class ToolConfigError extends TwinMCPError {
  public readonly toolName: string;

  constructor(toolName: string, message: string) {
    super('TOOL_CONFIG_ERROR', message, 400);
    this.name = 'ToolConfigError';
    this.toolName = toolName;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const mcpToolsService = new McpToolsService();
