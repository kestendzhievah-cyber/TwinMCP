// Initialisation du système MCP
import { initializeTools } from './tools'
import { initializeCache } from './core/cache'
import { initializeQueue } from './utils/queue'
import { initializeMetrics } from './utils/metrics'
import { logger } from '@/lib/logger'

export async function initializeMCP() {
  logger.info('Initializing MCP System...')

  try {
    // 1. Initialiser le cache
    await initializeCache()
    logger.info('Cache system initialized')

    // 2. Initialiser la queue
    await initializeQueue()
    logger.info('Queue system initialized')

    // 3. Initialiser les métriques
    await initializeMetrics()
    logger.info('Metrics system initialized')

    // 4. Initialiser les outils
    await initializeTools()
    logger.info('Tools system initialized')

    logger.info('MCP System fully initialized and ready!')

  } catch (error) {
    logger.error('Failed to initialize MCP System:', error)
    throw error
  }
}

export async function shutdownMCP() {
  logger.info('Shutting down MCP System...')

  try {
    // Fermer les systèmes dans l'ordre inverse
    const { closeQueue } = await import('./utils/queue')
    const { closeCache } = await import('./core/cache')
    const { getMetrics } = await import('./utils/metrics')
    const { rateLimiter } = await import('./middleware/rate-limit')

    // Destroy metrics collector (clears interval)
    getMetrics().destroy()
    logger.info('Metrics collector destroyed')

    // Destroy rate limiter (clears interval)
    rateLimiter.destroy()
    logger.info('Rate limiter destroyed')

    // Close queue (waits for workers)
    await closeQueue()
    logger.info('Queue closed')

    // Close cache (clears interval + Redis connection)
    await closeCache()
    logger.info('Cache closed')

    logger.info('MCP System shutdown complete')
  } catch (error) {
    logger.error('Error during MCP shutdown:', error)
  }
}
