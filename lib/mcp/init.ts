// Initialisation du système MCP
import { initializeTools } from './tools'
import { initializeCache } from './core/cache'
import { initializeQueue } from './utils/queue'
import { initializeMetrics } from './utils/metrics'

export async function initializeMCP() {
  console.log('🚀 Initializing MCP System...')

  try {
    // 1. Initialiser le cache
    await initializeCache()
    console.log('✅ Cache system initialized')

    // 2. Initialiser la queue
    await initializeQueue()
    console.log('✅ Queue system initialized')

    // 3. Initialiser les métriques
    await initializeMetrics()
    console.log('✅ Metrics system initialized')

    // 4. Initialiser les outils
    await initializeTools()
    console.log('✅ Tools system initialized')

    console.log('🎉 MCP System fully initialized and ready!')
    console.log('')
    console.log('📋 Available endpoints:')
    console.log('   GET    /api/v1/mcp/tools     - List available tools')
    console.log('   POST   /api/v1/mcp/execute   - Execute tools')
    console.log('   GET    /api/v1/mcp/health    - Health check')
    console.log('   GET    /api/v1/mcp/metrics   - System metrics')
    console.log('   GET    /api/v1/mcp/queue     - Queue management')
    console.log('')

  } catch (error) {
    console.error('❌ Failed to initialize MCP System:', error)
    throw error
  }
}

export async function shutdownMCP() {
  console.log('🛑 Shutting down MCP System...')

  try {
    // Fermer les systèmes dans l'ordre inverse
    const { closeQueue } = await import('./utils/queue')
    const { closeCache } = await import('./core/cache')
    const { getMetrics } = await import('./utils/metrics')
    const { rateLimiter } = await import('./middleware/rate-limit')

    // Destroy metrics collector (clears interval)
    getMetrics().destroy()
    console.log('✅ Metrics collector destroyed')

    // Destroy rate limiter (clears interval)
    rateLimiter.destroy()
    console.log('✅ Rate limiter destroyed')

    // Close queue (waits for workers)
    await closeQueue()
    console.log('✅ Queue closed')

    // Close cache (clears interval + Redis connection)
    await closeCache()
    console.log('✅ Cache closed')

    console.log('✅ MCP System shutdown complete')
  } catch (error) {
    console.error('❌ Error during MCP shutdown:', error)
  }
}
