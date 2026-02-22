// Lazy initialization singleton for MCP system
// Ensures initializeMCP() is called exactly once before any MCP route is processed

import { initializeMCP } from './init'
import { logger } from '@/lib/logger'

let initialized = false
let initPromise: Promise<void> | null = null

/**
 * Ensures the MCP system is initialized before processing requests.
 * This function is idempotent - calling it multiple times will only initialize once.
 * Safe to call from multiple concurrent requests.
 */
export async function ensureMCPInitialized(): Promise<void> {
  // Already initialized
  if (initialized) return

  // Initialization in progress - wait for it
  if (initPromise) return initPromise

  // Start initialization
  logger.info('Lazy initializing MCP system...')
  initPromise = initializeMCP()
    .then(() => {
      initialized = true
      logger.info('MCP system lazy initialization complete')
    })
    .catch((error) => {
      logger.error('MCP lazy initialization failed:', error)
      // Reset so next request can retry
      initPromise = null
      throw error
    })

  return initPromise
}

/**
 * Check if MCP system is initialized (for health checks)
 */
export function isMCPInitialized(): boolean {
  return initialized
}

/**
 * Reset initialization state (for testing purposes only)
 */
export function resetMCPInitialization(): void {
  initialized = false
  initPromise = null
}
